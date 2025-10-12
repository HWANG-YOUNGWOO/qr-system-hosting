"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCode = exports.sendVerificationCode = exports.getTwilioClient = void 0;
const secret_manager_1 = require("@google-cloud/secret-manager");
const twilio_1 = __importDefault(require("twilio"));
const logger_1 = require("./utils/logger");
const secretClient = new secret_manager_1.SecretManagerServiceClient();
async function getSecret(name) {
    var _a, _b;
    const [version] = await secretClient.accessSecretVersion({ name });
    return ((_b = (_a = version.payload) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.toString()) || '';
}
async function getTwilioConfig(testMode = false) {
    // Env var first: allow local development without Secret Manager.
    const envAccount = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
    const envAuth = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_TOKEN;
    const envService = process.env.TWILIO_VERIFY_SERVICE_SID || process.env.TWILIO_SERVICE_SID || process.env.TWILIO_SERVICE_SID;
    if (envAccount && envAuth && envService) {
        return { accountSid: envAccount, authToken: envAuth, serviceSid: envService };
    }
    // Resolve GCP project id from common envs; allow FIREBASE_CONFIG JSON as a local-dev fallback.
    let project = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!project && process.env.FIREBASE_CONFIG) {
        try {
            const cfg = JSON.parse(process.env.FIREBASE_CONFIG);
            if (cfg && cfg.projectId)
                project = cfg.projectId;
        }
        catch (err) {
            // ignore parse errors and continue to throw below if still missing
        }
    }
    if (!project)
        throw new Error('GCP project not set');
    const accountSidName = testMode
        ? `projects/${project}/secrets/Test-twilio-Account-SID/versions/latest`
        : `projects/${project}/secrets/twilio-sid/versions/latest`;
    const authTokenName = testMode
        ? `projects/${project}/secrets/Test-twilio-Auth-token/versions/latest`
        : `projects/${project}/secrets/twilio-token/versions/latest`;
    // Service SID (Verify) - allow test variant too (fallback to live if test not present)
    const serviceSidNameLive = `projects/${project}/secrets/twilio-service-sid/versions/latest`;
    const serviceSidNameTest = `projects/${project}/secrets/Test-twilio-service-sid/versions/latest`;
    const names = [accountSidName, authTokenName, testMode ? serviceSidNameTest : serviceSidNameLive, serviceSidNameLive];
    // Try to resolve secrets; the last element is fallback for serviceSid
    const results = await Promise.all(names.map((n) => getSecret(n).catch(() => '')));
    const [accountSid, authToken, serviceSidCandidate, serviceSidFallback] = results;
    const serviceSid = serviceSidCandidate || serviceSidFallback;
    if (!accountSid || !authToken || !serviceSid) {
        const missing = [];
        if (!accountSid)
            missing.push(testMode ? 'Test-twilio-Account-SID' : 'twilio-sid');
        if (!authToken)
            missing.push(testMode ? 'Test-twilio-Auth-token' : 'twilio-token');
        if (!serviceSid)
            missing.push('twilio-service-sid or Test-twilio-service-sid');
        const msg = `Twilio secrets not properly configured: missing ${missing.join(', ')}`;
        // Log a non-sensitive error to help debugging which secret name(s) are missing.
        (0, logger_1.logError)('getTwilioConfig', new Error(msg));
        throw new Error(msg);
    }
    return { accountSid, authToken, serviceSid };
}
async function getTwilioClient(testMode = false) {
    try {
        const cfg = await getTwilioConfig(testMode);
        return (0, twilio_1.default)(cfg.accountSid, cfg.authToken);
    }
    catch (err) {
        (0, logger_1.logError)('getTwilioClient', err);
        throw err;
    }
}
exports.getTwilioClient = getTwilioClient;
/**
 * Send verification code using Twilio Verify Service
 * Returns { sid, status, serviceSid }
 */
async function sendVerificationCode(phone, testMode = false) {
    const func = 'serviceTwilio.sendVerificationCode';
    const phoneLast4 = String(phone).slice(-4);
    (0, logger_1.logStart)(func, { phoneLast4, testMode });
    try {
        const cfg = await getTwilioConfig(testMode);
        const client = (0, twilio_1.default)(cfg.accountSid, cfg.authToken);
        const res = await client.verify.services(cfg.serviceSid).verifications.create({ to: phone, channel: 'sms' });
        (0, logger_1.logEnd)(func, { sid: res.sid, status: res.status });
        return { sid: res.sid, status: res.status, serviceSid: cfg.serviceSid };
    }
    catch (err) {
        (0, logger_1.logError)(func, err, { phoneLast4 });
        throw err;
    }
}
exports.sendVerificationCode = sendVerificationCode;
/**
 * Verify code using Twilio Verify Service
 * Returns { valid: boolean, status }
 */
async function verifyCode(phone, code, testMode = false) {
    const func = 'serviceTwilio.verifyCode';
    (0, logger_1.logStart)(func, { phone: phone.slice(-4), testMode });
    try {
        const cfg = await getTwilioConfig(testMode);
        const client = (0, twilio_1.default)(cfg.accountSid, cfg.authToken);
        const res = await client.verify.services(cfg.serviceSid).verificationChecks.create({ to: phone, code });
        const valid = res.status === 'approved';
        (0, logger_1.logEnd)(func, { status: res.status });
        return { valid, status: res.status };
    }
    catch (err) {
        (0, logger_1.logError)(func, err, { phone: phone.slice(-4) });
        throw err;
    }
}
exports.verifyCode = verifyCode;
//# sourceMappingURL=serviceTwilio.js.map