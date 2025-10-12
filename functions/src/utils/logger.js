"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logError = exports.logEnd = exports.logStart = void 0;
var functionsLogger = require("firebase-functions/logger");
function logStart(funcName, meta) {
    functionsLogger.info("[START] ".concat(funcName), meta || {});
}
exports.logStart = logStart;
function logEnd(funcName, meta) {
    functionsLogger.info("[END] ".concat(funcName), meta || {});
}
exports.logEnd = logEnd;
function logError(funcName, err, meta) {
    // Do not log sensitive values
    functionsLogger.error("[ERROR] ".concat(funcName), __assign({ error: String(err) }, meta));
}
exports.logError = logError;
