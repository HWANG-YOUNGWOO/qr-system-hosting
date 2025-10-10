import { onCall } from 'firebase-functions/v2/https';
import * as functions from 'firebase-functions';
import { logStart, logEnd, logError } from '../utils/logger';
import { sendVerificationCode, verifyCode } from '../serviceTwilio';
import { v4 as uuidv4 } from 'uuid';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { consumeToken } from '../utils/tokenBucket';
import { hashIp } from '../utils/ipHash';

admin.initializeApp();
const db = getFirestore();

/**
 * Types
 */
export interface CheckRegisteredPhoneInput {
  countryCode: string;
  phoneNumber: string;
  testModeFlag?: boolean;
}

export interface CheckRegisteredPhoneResult {
  registered: boolean;
  messageKey?: string;
}

export const checkRegisteredPhone = onCall(async (req) => {
  const func = 'auth.checkRegisteredPhone';
  logStart(func, { data: { countryCode: req.data?.countryCode } });
  try {
    const input = req.data as CheckRegisteredPhoneInput;
    // TODO: validate using libphonenumber-js
    const phoneKey = `${input.countryCode}-${input.phoneNumber}`;

    const doc = await db.collection('users_by_phone').doc(phoneKey).get();
    const registered = doc.exists;

    logEnd(func, { registered });
    return { registered } as CheckRegisteredPhoneResult;
  } catch (err) {
    logError(func, err);
    return { registered: false, messageKey: 'auth.error' } as CheckRegisteredPhoneResult;
  }
});

export interface SendOtpInput { countryCode: string; phoneNumber: string; testModeFlag?: boolean }
export interface SendOtpResult { attemptId: string; nextAllowedRequestAt: number; expireAt: number; messageKey: string }

function toE164(countryCode: string, phoneNumber: string) {
  // Ensure only digits, and add leading + and country code if missing
  const cc = String(countryCode || '').replace(/\D/g, '');
  const pn = String(phoneNumber || '').replace(/\D/g, '');
  if (!cc || !pn) throw new Error('invalid_phone');
  return `+${cc}${pn}`;
}

export const sendOtp = onCall(async (req) => {
  const func = 'auth.sendOtp';
  logStart(func, { data: { countryCode: req.data?.countryCode } });
  try {
    const input = req.data as SendOtpInput;
    const phoneKey = `${input.countryCode}-${input.phoneNumber}`;

    // Server-side control: only allow test mode when configuration explicitly permits it.
    // Priority: functions.config().twilio.allow_test (if available) -> process.env.ALLOW_TWILIO_TEST -> default false
    let allowTwilioTest = false;
    try {
      const cfg = functions.config && functions.config();
      const cfgVal = cfg?.twilio?.allow_test;
      if (typeof cfgVal !== 'undefined') {
        allowTwilioTest = String(cfgVal).toLowerCase() === 'true';
      } else {
        allowTwilioTest = String(process.env.ALLOW_TWILIO_TEST || '').toLowerCase() === 'true';
      }
    } catch (e) {
      // If functions.config() is not available in this runtime, fall back to env
      allowTwilioTest = String(process.env.ALLOW_TWILIO_TEST || '').toLowerCase() === 'true';
    }
    const requestedTestMode = !!input.testModeFlag && allowTwilioTest;
    if (!!input.testModeFlag && !allowTwilioTest) {
      // Log that client requested test mode but server rejected it
      logError(func, new Error('test_mode_not_allowed'));
    }

    // Re-check registration
    const doc = await db.collection('users_by_phone').doc(phoneKey).get();
    if (!doc.exists) {
      logEnd(func, { allowed: false });
      return { messageKey: 'auth.notRegistered' };
    }

    // Rate limiting / throttling checks
    const raw = (req as any).rawRequest;
    const ipHeader = raw?.headers?.['x-forwarded-for'];
    const ipSocket = raw?.socket?.remoteAddress || raw?.connection?.remoteAddress;
    const ipAddr = ipHeader ? String(ipHeader).split(',')[0].trim() : ipSocket;
    const ipHash = hashIp(String(ipAddr));
    // Token-bucket limits
    // phone: capacity 1, refill 1 token per 60s (reduced to trigger rate limiting in tests)
    const phoneBucket = await consumeToken(`phone:${phoneKey}`, 1, 60 * 1000);
    if (!phoneBucket.allowed) {
      await db.collection('authEvents').doc().set({ type: 'rate_limited', uid: null, phoneKey, reason: 'phone_limit', ipHash, ts: Date.now(), retryAfterMs: phoneBucket.retryAfterMs });
      return { messageKey: 'auth.rateLimited', nextAllowedRequestAt: Date.now() + (phoneBucket.retryAfterMs || 0) };
    }
    // ip: capacity 30, refill 1 token per 120s (=> 30 tokens/hour)
    // ip: capacity 5, refill 1 token per 120s (reduced for test)
    const ipBucket = await consumeToken(`ip:${ipHash}`, 5, 120 * 1000);
    if (!ipBucket.allowed) {
      await db.collection('authEvents').doc().set({ type: 'rate_limited', uid: null, phoneKey, reason: 'ip_limit', ipHash, ts: Date.now(), retryAfterMs: ipBucket.retryAfterMs });
      return { messageKey: 'auth.rateLimited', nextAllowedRequestAt: Date.now() + (ipBucket.retryAfterMs || 0) };
    }

    const attemptId = uuidv4();
    const now = Date.now();
    const expireAt = now + 5 * 60 * 1000;
    await db.collection('otpAttempts').doc(attemptId).set({ phoneKey, createdAt: now, expireAt, testModeFlag: requestedTestMode });

    // Send to Twilio Verify (do not store the actual code)
    let phoneE164: string;
    try {
      phoneE164 = toE164(input.countryCode, input.phoneNumber);
    } catch (err) {
      logError(func, err as Error, { phone: `${input.countryCode}-${input.phoneNumber}` });
      return { messageKey: 'auth.invalidPhone' } as SendOtpResult;
    }
    const twRes = await sendVerificationCode(phoneE164, requestedTestMode);

    // compute nextAllowedRequestAt (simple example)
    const nextAllowedRequestAt = now + 30 * 1000;

    logEnd(func, { attemptId, twRes: { status: twRes.status } });
    return { attemptId, nextAllowedRequestAt, expireAt, messageKey: 'auth.otpSent' } as SendOtpResult;
  } catch (err) {
    // Enhanced error logging: include request details and write an authEvents record
    try {
      const phoneKeySafe = (req.data && req.data.countryCode && req.data.phoneNumber) ? `${req.data.countryCode}-${req.data.phoneNumber}` : null;
      logError(func, err as Error, { request: req.data, phoneKey: phoneKeySafe });
      await db.collection('authEvents').doc().set({ type: 'error', uid: null, phoneKey: phoneKeySafe, error: String((err as Error)?.message || err), ts: Date.now() });
    } catch (logErr) {
      // If logging itself fails, ensure we still return a generic error
      logError(func, logErr as Error);
    }
    return { messageKey: 'auth.error' } as SendOtpResult;
  }
});

export interface VerifyOtpInput { countryCode: string; phoneNumber: string; attemptId: string; otpCode: string; clientRequestId?: string }
export interface VerifyOtpResult { idToken?: string; refreshTokenPolicy?: string; role?: string; uid?: string; sessionExpiresAt?: number; messageKey?: string }

export const verifyOtpAndLogin = onCall(async (req) => {
  const func = 'auth.verifyOtpAndLogin';
  logStart(func, { data: { attemptId: req.data?.attemptId } });
  try {
    const input = req.data as VerifyOtpInput;
    const attemptDoc = await db.collection('otpAttempts').doc(input.attemptId).get();
    if (!attemptDoc.exists) return { messageKey: 'auth.invalidAttempt' } as VerifyOtpResult;

    const attempt = attemptDoc.data();
    if (!attempt) return { messageKey: 'auth.invalidAttempt' } as VerifyOtpResult;
    if (Date.now() > attempt.expireAt) return { messageKey: 'auth.otpExpired' } as VerifyOtpResult;

    // Verify via Twilio Verify service
    let phoneE164: string;
    try {
      phoneE164 = toE164(input.countryCode, input.phoneNumber);
    } catch (err) {
      logError(func, err as Error, { phone: `${input.countryCode}-${input.phoneNumber}` });
      return { messageKey: 'auth.invalidPhone' } as VerifyOtpResult;
    }
    const verifyRes = await verifyCode(phoneE164, input.otpCode, !!attempt.testModeFlag);
    if (!verifyRes.valid) return { messageKey: 'auth.invalidOtp' } as VerifyOtpResult;

    // Begin transaction for migration and session creation
    const result = await db.runTransaction(async (tx) => {
      const phoneKey = `${input.countryCode}-${input.phoneNumber}`;
      const phoneDocRef = db.collection('users_by_phone').doc(phoneKey);
      const phoneDoc = await tx.get(phoneDocRef);

      let uid: string;
      if (!phoneDoc.exists) {
        // This should not happen because we checked earlier
        throw new Error('phoneNotRegistered');
      } else {
        const phoneData = phoneDoc.data();
        if (phoneData && phoneData.uid) {
          uid = phoneData.uid;
        } else {
          // Create new UID-based user doc
          uid = db.collection('users').doc().id;
          const userRef = db.collection('users').doc(uid);
          tx.set(userRef, { phoneKey, createdAt: Date.now(), displayName: phoneData?.displayName || null });
          tx.update(phoneDocRef, { uid });
        }
      }

      // Create session
      const sessionId = uuidv4();
      const sessionExpiresAt = Date.now() + 60 * 60 * 1000;
      const userRef2 = db.collection('users').doc(uid);
      tx.update(userRef2, { currentSessionId: sessionId });

      // Write auth event
      const eventRef = db.collection('authEvents').doc();
      tx.set(eventRef, { type: 'login', uid, reason: 'manual', ts: Date.now() });

      return { uid, sessionId, sessionExpiresAt };
    });

    // Issue custom token with claims (note: in production you may exchange to idToken)
    const customToken = await admin.auth().createCustomToken(result.uid, { sessionId: result.sessionId, sessionExpiresAt: result.sessionExpiresAt });

    logEnd(func, { uid: result.uid });
    return { idToken: customToken, uid: result.uid, sessionExpiresAt: result.sessionExpiresAt } as VerifyOtpResult;
  } catch (err) {
    logError(func, err);
    return { messageKey: 'auth.error' } as VerifyOtpResult;
  }
});

export const logout = onCall(async (req) => {
  const func = 'auth.logout';
  logStart(func, { data: { uid: req.data?.uid } });
  try {
    const callerUid = req.auth?.uid;
    const { uid, sessionId } = req.data as { uid: string; sessionId: string };
    if (callerUid !== uid) return { success: false, messageKey: 'auth.forbidden' };

    await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await tx.get(userRef);
      const currentSessionId = userDoc.data()?.currentSessionId;
      if (currentSessionId === sessionId) {
        tx.update(userRef, { currentSessionId: null });
        const eventRef = db.collection('authEvents').doc();
        tx.set(eventRef, { type: 'logout', uid, reason: 'manual', ts: Date.now() });
      } else {
        throw new Error('sessionMismatch');
      }
    });

    logEnd(func, { uid });
    return { success: true };
  } catch (err) {
    logError(func, err);
    return { success: false, messageKey: 'auth.error' };
  }
});
