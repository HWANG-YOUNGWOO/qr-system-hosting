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
    const phoneKey = `${input.countryCode}-${input.phoneNumber}`;

    const doc = await db.collection('users_by_phone').doc(phoneKey).get();
    const registered = doc.exists;

    logEnd(func, { registered });
    return { registered } as CheckRegisteredPhoneResult;
  } catch (err) {
    logError(func, err as Error);
    return { registered: false, messageKey: 'auth.error' } as CheckRegisteredPhoneResult;
  }
});

export interface SendOtpInput {
  countryCode: string;
  phoneNumber: string;
  testModeFlag?: boolean;
  displayName?: string;
}

export interface SendOtpResult {
  attemptId: string;
  nextAllowedRequestAt: number;
  expireAt: number;
  messageKey: string;
}

// Firestore document interfaces to avoid excessive `any` casts
interface UserDocData {
  uid?: string;
  displayName?: string;
  phoneKey?: string;
  currentSessionId?: string | null;
  [key: string]: unknown;
}

interface UsersByPhoneData {
  uid?: string;
  displayName?: string;
  phoneE164?: string;
  createdAt?: number;
  [key: string]: unknown;
}

interface OtpAttemptData {
  phoneKey?: string;
  createdAt?: number;
  expireAt?: number;
  testModeFlag?: boolean;
  [key: string]: unknown;
}

function toE164(countryCode: string, phoneNumber: string) {
  const cc = String(countryCode || '').replace(/\D/g, '');
  const pn = String(phoneNumber || '').replace(/\D/g, '');
  if (!cc || !pn) throw new Error('invalid_phone');
  return `+${cc}${pn}`;
}

function validateNameServer(name: unknown) {
  if (!name) return false;
  const s = String(name).trim();
  if (s.length < 2) return false;
  return /^[\u3131-\u318E\uAC00-\uD7A3A-Za-z0-9 -]+$/.test(s);
}

export const sendOtp = onCall(async (req) => {
  const func = 'auth.sendOtp';
  logStart(func, { data: { countryCode: req.data?.countryCode } });
  try {
    const input = req.data as SendOtpInput;

    const providedName = input && input.displayName ? String(input.displayName).trim() : '';
    if (!providedName) {
      try {
        await db.collection('authEvents').doc().set({
          type: 'invalid_user_missing_early',
          uid: null,
          phoneKey: `${input.countryCode}-${input.phoneNumber}`,
          ts: Date.now(),
        });
      } catch (e) {
        logError(func, e as Error);
      }
      logEnd(func, { allowed: false, reason: 'missing_display_name' });
      return { messageKey: 'auth.invalidUser' } as SendOtpResult;
    }

    if (!validateNameServer(providedName)) {
      try {
        await db.collection('authEvents').doc().set({
          type: 'invalid_user_bad_format_early',
          uid: null,
          phoneKey: `${input.countryCode}-${input.phoneNumber}`,
          providedName,
          ts: Date.now(),
        });
      } catch (e) {
        logError(func, e as Error);
      }
      logEnd(func, { allowed: false, reason: 'invalid_user_format' });
      return { messageKey: 'auth.invalidUser' } as SendOtpResult;
    }

    const phoneKey = `${input.countryCode}-${input.phoneNumber}`;

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
      allowTwilioTest = String(process.env.ALLOW_TWILIO_TEST || '').toLowerCase() === 'true';
    }

    const requestedTestMode = !!input.testModeFlag && allowTwilioTest;
    if (!!input.testModeFlag && !allowTwilioTest) {
      logError(func, new Error('test_mode_not_allowed'));
      try {
        await db.collection('authEvents').doc().set({
          type: 'test_mode_requested',
          uid: null,
          phoneKey,
          requested: true,
          allowed: false,
          ts: Date.now(),
        });
      } catch (e) {
        logError(func, e as Error);
      }
    }

    let doc = await db.collection('users_by_phone').doc(phoneKey).get();
    if (!doc.exists) {
      try {
        const phoneE164 = toE164(input.countryCode, input.phoneNumber);
        const userByE164Ref = db.collection('users').doc(phoneE164);
        const userDoc = await userByE164Ref.get();
        if (userDoc.exists) {
          try {
            await db.runTransaction(async (tx) => {
              const phoneDocRef = db.collection('users_by_phone').doc(phoneKey);
              const existing = await tx.get(phoneDocRef);
              if (!existing.exists) {
                const userData = (userDoc.data() || {}) as UserDocData;
                const uidFromUser = userData.uid || null;
                const setData: Record<string, unknown> = { createdAt: Date.now() };
                if (uidFromUser) setData.uid = uidFromUser;
                if (userData.displayName) setData.displayName = userData.displayName;
                tx.set(phoneDocRef, setData);
              }
            });
            doc = await db.collection('users_by_phone').doc(phoneKey).get();
          } catch (txErr) {
            logError(func, txErr as Error);
          }
        }
      } catch (e) {
        logError(func, e as Error);
      }
    }

    if (!doc.exists) {
      logEnd(func, { allowed: false });
      return { messageKey: 'auth.notRegistered' };
    }

    try {
      const phoneData = (doc.data() || {}) as UsersByPhoneData;
      if (phoneData.phoneE164) {
        try {
          const expected = String(phoneData.phoneE164);
          const requestedE164 = toE164(input.countryCode, input.phoneNumber);
          if (expected !== requestedE164) {
            await db.collection('authEvents').doc().set({
              type: 'invalid_phone_consistency',
              uid: null,
              phoneKey,
              expected,
              requested: requestedE164,
              ts: Date.now(),
            });
            logEnd(func, { allowed: false, reason: 'phone_mismatch' });
            return { messageKey: 'auth.invalidPhone' } as SendOtpResult;
          }
        } catch (e) {
          await db.collection('authEvents').doc().set({
            type: 'invalid_phone_parse',
            uid: null,
            phoneKey,
            error: String((e as Error)?.message || e),
            ts: Date.now(),
          });
          return { messageKey: 'auth.invalidPhone' } as SendOtpResult;
        }
      }

      if (!providedName) {
        await db.collection('authEvents').doc().set({ type: 'invalid_user_missing', uid: phoneData.uid || null, phoneKey, ts: Date.now() });
        logEnd(func, { allowed: false, reason: 'missing_display_name' });
        return { messageKey: 'auth.invalidUser' } as SendOtpResult;
      }
      if (!validateNameServer(providedName)) {
        await db.collection('authEvents').doc().set({ type: 'invalid_user_bad_format', uid: phoneData.uid || null, phoneKey, providedName, ts: Date.now() });
        logEnd(func, { allowed: false, reason: 'invalid_user_format' });
        return { messageKey: 'auth.invalidUser' } as SendOtpResult;
      }

      let storedName: string | null = null;
      if (phoneData.displayName) storedName = String(phoneData.displayName).trim();
      else if (phoneData.uid) {
        try {
          const userDoc = await db.collection('users').doc(String(phoneData.uid)).get();
          if (userDoc.exists) {
            const ud = (userDoc.data() || {}) as UserDocData;
            if (ud.displayName) storedName = String(ud.displayName).trim();
          }
        } catch (e) {
          logError(func, e as Error);
        }
      }

      if (!storedName) {
        await db.collection('authEvents').doc().set({ type: 'invalid_user_no_stored_name', uid: phoneData.uid || null, phoneKey, ts: Date.now() });
        logEnd(func, { allowed: false, reason: 'no_stored_name' });
        return { messageKey: 'auth.invalidUser' } as SendOtpResult;
      }

      const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
      if (norm(providedName) !== norm(storedName)) {
        await db.collection('authEvents').doc().set({ type: 'invalid_user_mismatch', uid: phoneData.uid || null, phoneKey, providedName, storedName, ts: Date.now() });
        logEnd(func, { allowed: false, reason: 'name_mismatch' });
        return { messageKey: 'auth.invalidUser' } as SendOtpResult;
      }
    } catch (vErr) {
      logError(func, vErr as Error);
      return { messageKey: 'auth.error' } as SendOtpResult;
    }

    type RawRequestLike = {
      rawRequest?: {
        headers?: Record<string, string | string[] | undefined>;
        socket?: { remoteAddress?: string };
        connection?: { remoteAddress?: string };
      };
    };
    const raw = (req as unknown as RawRequestLike).rawRequest;
    const ipHeader = raw?.headers?.['x-forwarded-for'];
    const ipSocket = raw?.socket?.remoteAddress || raw?.connection?.remoteAddress;
    const ipAddr = ipHeader ? String(ipHeader).split(',')[0].trim() : ipSocket;
    const ipHash = hashIp(String(ipAddr));

    const phoneBucket = await consumeToken(`phone:${phoneKey}`, 1, 60 * 1000);
    if (!phoneBucket.allowed) {
      await db.collection('authEvents').doc().set({ type: 'rate_limited', uid: null, phoneKey, reason: 'phone_limit', ipHash, ts: Date.now(), retryAfterMs: phoneBucket.retryAfterMs });
      return { messageKey: 'auth.rateLimited', nextAllowedRequestAt: Date.now() + (phoneBucket.retryAfterMs || 0) };
    }

    const ipBucket = await consumeToken(`ip:${ipHash}`, 5, 120 * 1000);
    if (!ipBucket.allowed) {
      await db.collection('authEvents').doc().set({ type: 'rate_limited', uid: null, phoneKey, reason: 'ip_limit', ipHash, ts: Date.now(), retryAfterMs: ipBucket.retryAfterMs });
      return { messageKey: 'auth.rateLimited', nextAllowedRequestAt: Date.now() + (ipBucket.retryAfterMs || 0) };
    }

    const attemptId = uuidv4();
    const now = Date.now();
    const expireAt = now + 5 * 60 * 1000;
    await db.collection('otpAttempts').doc(attemptId).set({ phoneKey, createdAt: now, expireAt, testModeFlag: requestedTestMode });

    try {
      await db.collection('authEvents').doc().set({ type: 'test_mode_used', uid: null, phoneKey, attemptId, requested: !!input.testModeFlag, used: requestedTestMode, ts: Date.now() });
    } catch (e) {
      logError(func, e as Error);
    }

    let phoneE164: string;
    try {
      phoneE164 = toE164(input.countryCode, input.phoneNumber);
    } catch (err) {
      logError(func, err as Error, { phone: `${input.countryCode}-${input.phoneNumber}` });
      return { messageKey: 'auth.invalidPhone' } as SendOtpResult;
    }
    const twRes = await sendVerificationCode(phoneE164, requestedTestMode);
    const nextAllowedRequestAt = now + 30 * 1000;

    const twStatus = (twRes as unknown as { status?: unknown })?.status ?? null;
    logEnd(func, { attemptId, twRes: { status: String(twStatus) } });
    return { attemptId, nextAllowedRequestAt, expireAt, messageKey: 'auth.otpSent' } as SendOtpResult;
  } catch (err) {
    try {
      const phoneKeySafe = (req.data && req.data.countryCode && req.data.phoneNumber) ? `${req.data.countryCode}-${req.data.phoneNumber}` : null;
      logError(func, err as Error, { request: req.data, phoneKey: phoneKeySafe });
      await db.collection('authEvents').doc().set({ type: 'error', uid: null, phoneKey: phoneKeySafe, error: String((err as Error)?.message || err), ts: Date.now() });
    } catch (logErr) {
      logError(func, logErr as Error);
    }
    return { messageKey: 'auth.error' } as SendOtpResult;
  }
});

export interface VerifyOtpInput {
  countryCode: string;
  phoneNumber: string;
  attemptId: string;
  otpCode: string;
  clientRequestId?: string;
}

export interface VerifyOtpResult {
  idToken?: string;
  refreshTokenPolicy?: string;
  role?: string;
  uid?: string;
  sessionExpiresAt?: number;
  messageKey?: string;
}

export const verifyOtpAndLogin = onCall(async (req) => {
  const func = 'auth.verifyOtpAndLogin';
  logStart(func, { data: { attemptId: req.data?.attemptId } });
  try {
    const input = req.data as VerifyOtpInput;
    const attemptDoc = await db.collection('otpAttempts').doc(input.attemptId).get();
    if (!attemptDoc.exists) return { messageKey: 'auth.invalidAttempt' } as VerifyOtpResult;

    const attempt = attemptDoc.data() as OtpAttemptData | undefined;
    if (!attempt) return { messageKey: 'auth.invalidAttempt' } as VerifyOtpResult;
    if (Date.now() > (attempt.expireAt || 0)) return { messageKey: 'auth.otpExpired' } as VerifyOtpResult;

    let phoneE164: string;
    try {
      phoneE164 = toE164(input.countryCode, input.phoneNumber);
    } catch (err) {
      logError(func, err as Error, { phone: `${input.countryCode}-${input.phoneNumber}` });
      return { messageKey: 'auth.invalidPhone' } as VerifyOtpResult;
    }

    const verifyRes = await verifyCode(phoneE164, input.otpCode, !!attempt.testModeFlag);
    const verifyValid = (verifyRes as unknown as { valid?: boolean })?.valid;
    if (!verifyValid) return { messageKey: 'auth.invalidOtp' } as VerifyOtpResult;

    const result = await db.runTransaction(async (tx) => {
      const phoneKey = `${input.countryCode}-${input.phoneNumber}`;
      const phoneDocRef = db.collection('users_by_phone').doc(phoneKey);
      const phoneDoc = await tx.get(phoneDocRef);

      let uid: string;
      if (!phoneDoc.exists) {
        throw new Error('phoneNotRegistered');
      } else {
        const phoneData = (phoneDoc.data() || {}) as UsersByPhoneData;
        if (phoneData.uid) {
          uid = phoneData.uid;
        } else {
          uid = db.collection('users').doc().id;
          const userRef = db.collection('users').doc(uid);
          tx.set(userRef, { phoneKey, createdAt: Date.now(), displayName: phoneData.displayName || null });
          tx.update(phoneDocRef, { uid });
        }
      }

      const sessionId = uuidv4();
      const sessionExpiresAt = Date.now() + 60 * 60 * 1000;
      const userRef2 = db.collection('users').doc(uid);
      tx.update(userRef2, { currentSessionId: sessionId });

      const eventRef = db.collection('authEvents').doc();
      tx.set(eventRef, { type: 'login', uid, reason: 'manual', ts: Date.now() });

      return { uid, sessionId, sessionExpiresAt };
    });

    const customToken = await admin.auth().createCustomToken(result.uid, { sessionId: result.sessionId, sessionExpiresAt: result.sessionExpiresAt });

    logEnd(func, { uid: result.uid });
    return { idToken: customToken, uid: result.uid, sessionExpiresAt: result.sessionExpiresAt } as VerifyOtpResult;
  } catch (err) {
    logError(func, err as Error);
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
      const ud = (userDoc.data() || {}) as UserDocData;
      const currentSessionId = ud?.currentSessionId;
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
    logError(func, err as Error);
    return { success: false, messageKey: 'auth.error' };
  }
});

