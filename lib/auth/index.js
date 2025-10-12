"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.verifyOtpAndLogin = exports.sendOtp = exports.checkRegisteredPhone = void 0;
const https_1 = require("firebase-functions/v2/https");
const functions = __importStar(require("firebase-functions"));
const logger_1 = require("../utils/logger");
const serviceTwilio_1 = require("../serviceTwilio");
const uuid_1 = require("uuid");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const tokenBucket_1 = require("../utils/tokenBucket");
const ipHash_1 = require("../utils/ipHash");
firebase_admin_1.default.initializeApp();
const db = (0, firestore_1.getFirestore)();
exports.checkRegisteredPhone = (0, https_1.onCall)(async (req) => {
    var _a;
    const func = 'auth.checkRegisteredPhone';
    (0, logger_1.logStart)(func, { data: { countryCode: (_a = req.data) === null || _a === void 0 ? void 0 : _a.countryCode } });
    try {
        const input = req.data;
        const phoneKey = `${input.countryCode}-${input.phoneNumber}`;
        const doc = await db.collection('users_by_phone').doc(phoneKey).get();
        const registered = doc.exists;
        (0, logger_1.logEnd)(func, { registered });
        return { registered };
    }
    catch (err) {
        (0, logger_1.logError)(func, err);
        return { registered: false, messageKey: 'auth.error' };
    }
});
function toE164(countryCode, phoneNumber) {
    const cc = String(countryCode || '').replace(/\D/g, '');
    const pn = String(phoneNumber || '').replace(/\D/g, '');
    if (!cc || !pn)
        throw new Error('invalid_phone');
    return `+${cc}${pn}`;
}
function validateNameServer(name) {
    if (!name)
        return false;
    const s = String(name).trim();
    if (s.length < 2)
        return false;
    return /^[\u3131-\u318E\uAC00-\uD7A3A-Za-z0-9 -]+$/.test(s);
}
exports.sendOtp = (0, https_1.onCall)(async (req) => {
    var _a, _b, _c, _d, _e, _f;
    const func = 'auth.sendOtp';
    (0, logger_1.logStart)(func, { data: { countryCode: (_a = req.data) === null || _a === void 0 ? void 0 : _a.countryCode } });
    try {
        const input = req.data;
        const providedName = input && input.displayName ? String(input.displayName).trim() : '';
        if (!providedName) {
            try {
                await db.collection('authEvents').doc().set({
                    type: 'invalid_user_missing_early',
                    uid: null,
                    phoneKey: `${input.countryCode}-${input.phoneNumber}`,
                    ts: Date.now(),
                });
            }
            catch (e) {
                (0, logger_1.logError)(func, e);
            }
            (0, logger_1.logEnd)(func, { allowed: false, reason: 'missing_display_name' });
            return { messageKey: 'auth.invalidUser' };
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
            }
            catch (e) {
                (0, logger_1.logError)(func, e);
            }
            (0, logger_1.logEnd)(func, { allowed: false, reason: 'invalid_user_format' });
            return { messageKey: 'auth.invalidUser' };
        }
        const phoneKey = `${input.countryCode}-${input.phoneNumber}`;
        let allowTwilioTest = false;
        try {
            const cfg = functions.config && functions.config();
            const cfgVal = (_b = cfg === null || cfg === void 0 ? void 0 : cfg.twilio) === null || _b === void 0 ? void 0 : _b.allow_test;
            if (typeof cfgVal !== 'undefined') {
                allowTwilioTest = String(cfgVal).toLowerCase() === 'true';
            }
            else {
                allowTwilioTest = String(process.env.ALLOW_TWILIO_TEST || '').toLowerCase() === 'true';
            }
        }
        catch (e) {
            allowTwilioTest = String(process.env.ALLOW_TWILIO_TEST || '').toLowerCase() === 'true';
        }
        const requestedTestMode = !!input.testModeFlag && allowTwilioTest;
        if (!!input.testModeFlag && !allowTwilioTest) {
            (0, logger_1.logError)(func, new Error('test_mode_not_allowed'));
            try {
                await db.collection('authEvents').doc().set({
                    type: 'test_mode_requested',
                    uid: null,
                    phoneKey,
                    requested: true,
                    allowed: false,
                    ts: Date.now(),
                });
            }
            catch (e) {
                (0, logger_1.logError)(func, e);
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
                                const userData = (userDoc.data() || {});
                                const uidFromUser = userData.uid || null;
                                const setData = { createdAt: Date.now() };
                                if (uidFromUser)
                                    setData.uid = uidFromUser;
                                if (userData.displayName)
                                    setData.displayName = userData.displayName;
                                tx.set(phoneDocRef, setData);
                            }
                        });
                        doc = await db.collection('users_by_phone').doc(phoneKey).get();
                    }
                    catch (txErr) {
                        (0, logger_1.logError)(func, txErr);
                    }
                }
            }
            catch (e) {
                (0, logger_1.logError)(func, e);
            }
        }
        if (!doc.exists) {
            (0, logger_1.logEnd)(func, { allowed: false });
            return { messageKey: 'auth.notRegistered' };
        }
        try {
            const phoneData = (doc.data() || {});
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
                        (0, logger_1.logEnd)(func, { allowed: false, reason: 'phone_mismatch' });
                        return { messageKey: 'auth.invalidPhone' };
                    }
                }
                catch (e) {
                    await db.collection('authEvents').doc().set({
                        type: 'invalid_phone_parse',
                        uid: null,
                        phoneKey,
                        error: String((e === null || e === void 0 ? void 0 : e.message) || e),
                        ts: Date.now(),
                    });
                    return { messageKey: 'auth.invalidPhone' };
                }
            }
            if (!providedName) {
                await db.collection('authEvents').doc().set({ type: 'invalid_user_missing', uid: phoneData.uid || null, phoneKey, ts: Date.now() });
                (0, logger_1.logEnd)(func, { allowed: false, reason: 'missing_display_name' });
                return { messageKey: 'auth.invalidUser' };
            }
            if (!validateNameServer(providedName)) {
                await db.collection('authEvents').doc().set({ type: 'invalid_user_bad_format', uid: phoneData.uid || null, phoneKey, providedName, ts: Date.now() });
                (0, logger_1.logEnd)(func, { allowed: false, reason: 'invalid_user_format' });
                return { messageKey: 'auth.invalidUser' };
            }
            let storedName = null;
            if (phoneData.displayName)
                storedName = String(phoneData.displayName).trim();
            else if (phoneData.uid) {
                try {
                    const userDoc = await db.collection('users').doc(String(phoneData.uid)).get();
                    if (userDoc.exists) {
                        const ud = (userDoc.data() || {});
                        if (ud.displayName)
                            storedName = String(ud.displayName).trim();
                    }
                }
                catch (e) {
                    (0, logger_1.logError)(func, e);
                }
            }
            if (!storedName) {
                await db.collection('authEvents').doc().set({ type: 'invalid_user_no_stored_name', uid: phoneData.uid || null, phoneKey, ts: Date.now() });
                (0, logger_1.logEnd)(func, { allowed: false, reason: 'no_stored_name' });
                return { messageKey: 'auth.invalidUser' };
            }
            const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
            if (norm(providedName) !== norm(storedName)) {
                await db.collection('authEvents').doc().set({ type: 'invalid_user_mismatch', uid: phoneData.uid || null, phoneKey, providedName, storedName, ts: Date.now() });
                (0, logger_1.logEnd)(func, { allowed: false, reason: 'name_mismatch' });
                return { messageKey: 'auth.invalidUser' };
            }
        }
        catch (vErr) {
            (0, logger_1.logError)(func, vErr);
            return { messageKey: 'auth.error' };
        }
        const raw = req.rawRequest;
        const ipHeader = (_c = raw === null || raw === void 0 ? void 0 : raw.headers) === null || _c === void 0 ? void 0 : _c['x-forwarded-for'];
        const ipSocket = ((_d = raw === null || raw === void 0 ? void 0 : raw.socket) === null || _d === void 0 ? void 0 : _d.remoteAddress) || ((_e = raw === null || raw === void 0 ? void 0 : raw.connection) === null || _e === void 0 ? void 0 : _e.remoteAddress);
        const ipAddr = ipHeader ? String(ipHeader).split(',')[0].trim() : ipSocket;
        const ipHash = (0, ipHash_1.hashIp)(String(ipAddr));
        const phoneBucket = await (0, tokenBucket_1.consumeToken)(`phone:${phoneKey}`, 1, 60 * 1000);
        if (!phoneBucket.allowed) {
            await db.collection('authEvents').doc().set({ type: 'rate_limited', uid: null, phoneKey, reason: 'phone_limit', ipHash, ts: Date.now(), retryAfterMs: phoneBucket.retryAfterMs });
            return { messageKey: 'auth.rateLimited', nextAllowedRequestAt: Date.now() + (phoneBucket.retryAfterMs || 0) };
        }
        const ipBucket = await (0, tokenBucket_1.consumeToken)(`ip:${ipHash}`, 5, 120 * 1000);
        if (!ipBucket.allowed) {
            await db.collection('authEvents').doc().set({ type: 'rate_limited', uid: null, phoneKey, reason: 'ip_limit', ipHash, ts: Date.now(), retryAfterMs: ipBucket.retryAfterMs });
            return { messageKey: 'auth.rateLimited', nextAllowedRequestAt: Date.now() + (ipBucket.retryAfterMs || 0) };
        }
        const attemptId = (0, uuid_1.v4)();
        const now = Date.now();
        const expireAt = now + 5 * 60 * 1000;
        await db.collection('otpAttempts').doc(attemptId).set({ phoneKey, createdAt: now, expireAt, testModeFlag: requestedTestMode });
        try {
            await db.collection('authEvents').doc().set({ type: 'test_mode_used', uid: null, phoneKey, attemptId, requested: !!input.testModeFlag, used: requestedTestMode, ts: Date.now() });
        }
        catch (e) {
            (0, logger_1.logError)(func, e);
        }
        let phoneE164;
        try {
            phoneE164 = toE164(input.countryCode, input.phoneNumber);
        }
        catch (err) {
            (0, logger_1.logError)(func, err, { phone: `${input.countryCode}-${input.phoneNumber}` });
            return { messageKey: 'auth.invalidPhone' };
        }
        const twRes = await (0, serviceTwilio_1.sendVerificationCode)(phoneE164, requestedTestMode);
        const nextAllowedRequestAt = now + 30 * 1000;
        const twStatus = (_f = twRes === null || twRes === void 0 ? void 0 : twRes.status) !== null && _f !== void 0 ? _f : null;
        (0, logger_1.logEnd)(func, { attemptId, twRes: { status: String(twStatus) } });
        return { attemptId, nextAllowedRequestAt, expireAt, messageKey: 'auth.otpSent' };
    }
    catch (err) {
        try {
            const phoneKeySafe = (req.data && req.data.countryCode && req.data.phoneNumber) ? `${req.data.countryCode}-${req.data.phoneNumber}` : null;
            (0, logger_1.logError)(func, err, { request: req.data, phoneKey: phoneKeySafe });
            await db.collection('authEvents').doc().set({ type: 'error', uid: null, phoneKey: phoneKeySafe, error: String((err === null || err === void 0 ? void 0 : err.message) || err), ts: Date.now() });
        }
        catch (logErr) {
            (0, logger_1.logError)(func, logErr);
        }
        return { messageKey: 'auth.error' };
    }
});
exports.verifyOtpAndLogin = (0, https_1.onCall)(async (req) => {
    var _a;
    const func = 'auth.verifyOtpAndLogin';
    (0, logger_1.logStart)(func, { data: { attemptId: (_a = req.data) === null || _a === void 0 ? void 0 : _a.attemptId } });
    try {
        const input = req.data;
        const attemptDoc = await db.collection('otpAttempts').doc(input.attemptId).get();
        if (!attemptDoc.exists)
            return { messageKey: 'auth.invalidAttempt' };
        const attempt = attemptDoc.data();
        if (!attempt)
            return { messageKey: 'auth.invalidAttempt' };
        if (Date.now() > (attempt.expireAt || 0))
            return { messageKey: 'auth.otpExpired' };
        let phoneE164;
        try {
            phoneE164 = toE164(input.countryCode, input.phoneNumber);
        }
        catch (err) {
            (0, logger_1.logError)(func, err, { phone: `${input.countryCode}-${input.phoneNumber}` });
            return { messageKey: 'auth.invalidPhone' };
        }
        const verifyRes = await (0, serviceTwilio_1.verifyCode)(phoneE164, input.otpCode, !!attempt.testModeFlag);
        const verifyValid = verifyRes === null || verifyRes === void 0 ? void 0 : verifyRes.valid;
        if (!verifyValid)
            return { messageKey: 'auth.invalidOtp' };
        const result = await db.runTransaction(async (tx) => {
            const phoneKey = `${input.countryCode}-${input.phoneNumber}`;
            const phoneDocRef = db.collection('users_by_phone').doc(phoneKey);
            const phoneDoc = await tx.get(phoneDocRef);
            let uid;
            if (!phoneDoc.exists) {
                throw new Error('phoneNotRegistered');
            }
            else {
                const phoneData = (phoneDoc.data() || {});
                if (phoneData.uid) {
                    uid = phoneData.uid;
                }
                else {
                    uid = db.collection('users').doc().id;
                    const userRef = db.collection('users').doc(uid);
                    tx.set(userRef, { phoneKey, createdAt: Date.now(), displayName: phoneData.displayName || null });
                    tx.update(phoneDocRef, { uid });
                }
            }
            const sessionId = (0, uuid_1.v4)();
            const sessionExpiresAt = Date.now() + 60 * 60 * 1000;
            const userRef2 = db.collection('users').doc(uid);
            tx.update(userRef2, { currentSessionId: sessionId });
            const eventRef = db.collection('authEvents').doc();
            tx.set(eventRef, { type: 'login', uid, reason: 'manual', ts: Date.now() });
            return { uid, sessionId, sessionExpiresAt };
        });
        const customToken = await firebase_admin_1.default.auth().createCustomToken(result.uid, { sessionId: result.sessionId, sessionExpiresAt: result.sessionExpiresAt });
        (0, logger_1.logEnd)(func, { uid: result.uid });
        return { idToken: customToken, uid: result.uid, sessionExpiresAt: result.sessionExpiresAt };
    }
    catch (err) {
        (0, logger_1.logError)(func, err);
        return { messageKey: 'auth.error' };
    }
});
exports.logout = (0, https_1.onCall)(async (req) => {
    var _a, _b;
    const func = 'auth.logout';
    (0, logger_1.logStart)(func, { data: { uid: (_a = req.data) === null || _a === void 0 ? void 0 : _a.uid } });
    try {
        const callerUid = (_b = req.auth) === null || _b === void 0 ? void 0 : _b.uid;
        const { uid, sessionId } = req.data;
        if (callerUid !== uid)
            return { success: false, messageKey: 'auth.forbidden' };
        await db.runTransaction(async (tx) => {
            const userRef = db.collection('users').doc(uid);
            const userDoc = await tx.get(userRef);
            const ud = (userDoc.data() || {});
            const currentSessionId = ud === null || ud === void 0 ? void 0 : ud.currentSessionId;
            if (currentSessionId === sessionId) {
                tx.update(userRef, { currentSessionId: null });
                const eventRef = db.collection('authEvents').doc();
                tx.set(eventRef, { type: 'logout', uid, reason: 'manual', ts: Date.now() });
            }
            else {
                throw new Error('sessionMismatch');
            }
        });
        (0, logger_1.logEnd)(func, { uid });
        return { success: true };
    }
    catch (err) {
        (0, logger_1.logError)(func, err);
        return { success: false, messageKey: 'auth.error' };
    }
});
//# sourceMappingURL=index.js.map