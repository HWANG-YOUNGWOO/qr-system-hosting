"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashIp = void 0;
const crypto_1 = __importDefault(require("crypto"));
function hashIp(ip) {
    if (!ip)
        return 'unknown';
    return crypto_1.default.createHash('sha256').update(ip).digest('hex').slice(0, 32);
}
exports.hashIp = hashIp;
//# sourceMappingURL=ipHash.js.map