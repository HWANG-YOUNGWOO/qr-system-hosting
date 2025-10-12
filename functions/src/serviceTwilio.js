"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCode = exports.sendVerificationCode = exports.getTwilioClient = void 0;
var secret_manager_1 = require("@google-cloud/secret-manager");
var twilio_1 = require("twilio");
var logger_1 = require("./utils/logger");
var secretClient = new secret_manager_1.SecretManagerServiceClient();
function getSecret(name) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
        var version;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, secretClient.accessSecretVersion({ name: name })];
                case 1:
                    version = (_c.sent())[0];
                    return [2 /*return*/, ((_b = (_a = version.payload) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.toString()) || ''];
            }
        });
    });
}
function getTwilioConfig(testMode) {
    if (testMode === void 0) { testMode = false; }
    return __awaiter(this, void 0, void 0, function () {
        var envAccount, envAuth, envService, project, cfg, accountSidName, authTokenName, serviceSidNameLive, serviceSidNameTest, names, results, accountSid, authToken, serviceSidCandidate, serviceSidFallback, serviceSid, missing, msg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    envAccount = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
                    envAuth = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_TOKEN;
                    envService = process.env.TWILIO_VERIFY_SERVICE_SID || process.env.TWILIO_SERVICE_SID || process.env.TWILIO_SERVICE_SID;
                    if (envAccount && envAuth && envService) {
                        return [2 /*return*/, { accountSid: envAccount, authToken: envAuth, serviceSid: envService }];
                    }
                    project = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
                    if (!project && process.env.FIREBASE_CONFIG) {
                        try {
                            cfg = JSON.parse(process.env.FIREBASE_CONFIG);
                            if (cfg && cfg.projectId)
                                project = cfg.projectId;
                        }
                        catch (err) {
                            // ignore parse errors and continue to throw below if still missing
                        }
                    }
                    if (!project)
                        throw new Error('GCP project not set');
                    accountSidName = testMode
                        ? "projects/".concat(project, "/secrets/Test-twilio-Account-SID/versions/latest")
                        : "projects/".concat(project, "/secrets/twilio-sid/versions/latest");
                    authTokenName = testMode
                        ? "projects/".concat(project, "/secrets/Test-twilio-Auth-token/versions/latest")
                        : "projects/".concat(project, "/secrets/twilio-token/versions/latest");
                    serviceSidNameLive = "projects/".concat(project, "/secrets/twilio-service-sid/versions/latest");
                    serviceSidNameTest = "projects/".concat(project, "/secrets/Test-twilio-service-sid/versions/latest");
                    names = [accountSidName, authTokenName, testMode ? serviceSidNameTest : serviceSidNameLive, serviceSidNameLive];
                    return [4 /*yield*/, Promise.all(names.map(function (n) { return getSecret(n).catch(function () { return ''; }); }))];
                case 1:
                    results = _a.sent();
                    accountSid = results[0], authToken = results[1], serviceSidCandidate = results[2], serviceSidFallback = results[3];
                    serviceSid = serviceSidCandidate || serviceSidFallback;
                    if (!accountSid || !authToken || !serviceSid) {
                        missing = [];
                        if (!accountSid)
                            missing.push(testMode ? 'Test-twilio-Account-SID' : 'twilio-sid');
                        if (!authToken)
                            missing.push(testMode ? 'Test-twilio-Auth-token' : 'twilio-token');
                        if (!serviceSid)
                            missing.push('twilio-service-sid or Test-twilio-service-sid');
                        msg = "Twilio secrets not properly configured: missing ".concat(missing.join(', '));
                        // Log a non-sensitive error to help debugging which secret name(s) are missing.
                        (0, logger_1.logError)('getTwilioConfig', new Error(msg));
                        throw new Error(msg);
                    }
                    return [2 /*return*/, { accountSid: accountSid, authToken: authToken, serviceSid: serviceSid }];
            }
        });
    });
}
function getTwilioClient(testMode) {
    if (testMode === void 0) { testMode = false; }
    return __awaiter(this, void 0, void 0, function () {
        var cfg, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getTwilioConfig(testMode)];
                case 1:
                    cfg = _a.sent();
                    return [2 /*return*/, (0, twilio_1.default)(cfg.accountSid, cfg.authToken)];
                case 2:
                    err_1 = _a.sent();
                    (0, logger_1.logError)('getTwilioClient', err_1);
                    throw err_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
exports.getTwilioClient = getTwilioClient;
/**
 * Send verification code using Twilio Verify Service
 * Returns { sid, status, serviceSid }
 */
function sendVerificationCode(phone, testMode) {
    if (testMode === void 0) { testMode = false; }
    return __awaiter(this, void 0, void 0, function () {
        var func, phoneLast4, cfg, client, res, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    func = 'serviceTwilio.sendVerificationCode';
                    phoneLast4 = String(phone).slice(-4);
                    (0, logger_1.logStart)(func, { phoneLast4: phoneLast4, testMode: testMode });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, getTwilioConfig(testMode)];
                case 2:
                    cfg = _a.sent();
                    client = (0, twilio_1.default)(cfg.accountSid, cfg.authToken);
                    return [4 /*yield*/, client.verify.services(cfg.serviceSid).verifications.create({ to: phone, channel: 'sms' })];
                case 3:
                    res = _a.sent();
                    (0, logger_1.logEnd)(func, { sid: res.sid, status: res.status });
                    return [2 /*return*/, { sid: res.sid, status: res.status, serviceSid: cfg.serviceSid }];
                case 4:
                    err_2 = _a.sent();
                    (0, logger_1.logError)(func, err_2, { phoneLast4: phoneLast4 });
                    throw err_2;
                case 5: return [2 /*return*/];
            }
        });
    });
}
exports.sendVerificationCode = sendVerificationCode;
/**
 * Verify code using Twilio Verify Service
 * Returns { valid: boolean, status }
 */
function verifyCode(phone, code, testMode) {
    if (testMode === void 0) { testMode = false; }
    return __awaiter(this, void 0, void 0, function () {
        var func, cfg, client, res, valid, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    func = 'serviceTwilio.verifyCode';
                    (0, logger_1.logStart)(func, { phone: phone.slice(-4), testMode: testMode });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, getTwilioConfig(testMode)];
                case 2:
                    cfg = _a.sent();
                    client = (0, twilio_1.default)(cfg.accountSid, cfg.authToken);
                    return [4 /*yield*/, client.verify.services(cfg.serviceSid).verificationChecks.create({ to: phone, code: code })];
                case 3:
                    res = _a.sent();
                    valid = res.status === 'approved';
                    (0, logger_1.logEnd)(func, { status: res.status });
                    return [2 /*return*/, { valid: valid, status: res.status }];
                case 4:
                    err_3 = _a.sent();
                    (0, logger_1.logError)(func, err_3, { phone: phone.slice(-4) });
                    throw err_3;
                case 5: return [2 /*return*/];
            }
        });
    });
}
exports.verifyCode = verifyCode;
