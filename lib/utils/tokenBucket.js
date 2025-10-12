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
Object.defineProperty(exports, "__esModule", { value: true });
exports.consumeToken = void 0;
/**
 * token bucket stored per key in Firestore. Document shape:
 * { tokens: number, lastRefillTs: number, capacity: number, refillRateMsPerToken: number }
 */
async function consumeToken(key, capacity, refillMsPerToken) {
    // Lazy-import Firestore so we don't call getFirestore() at module-load time.
    // That prevents "default Firebase app does not exist" errors when the
    // functions runtime initializes firebase-admin later.
    const { getFirestore } = await Promise.resolve().then(() => __importStar(require('firebase-admin/firestore')));
    const db = getFirestore();
    const docRef = db.collection('tokenBuckets').doc(key);
    const now = Date.now();
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists) {
            tx.set(docRef, { tokens: capacity - 1, lastRefillTs: now, capacity, refillMsPerToken });
            return { allowed: true, tokensLeft: capacity - 1 };
        }
        const data = snap.data();
        const elapsed = now - data.lastRefillTs;
        const tokensToAdd = Math.floor(elapsed / data.refillMsPerToken);
        let tokens = Math.min(data.capacity, data.tokens + tokensToAdd);
        const lastRefillTs = tokensToAdd > 0 ? data.lastRefillTs + tokensToAdd * data.refillMsPerToken : data.lastRefillTs;
        if (tokens <= 0) {
            // calculate retryAfter
            const retryAfterMs = data.refillMsPerToken - (elapsed % data.refillMsPerToken);
            return { allowed: false, retryAfterMs };
        }
        tokens -= 1;
        tx.update(docRef, { tokens, lastRefillTs });
        return { allowed: true, tokensLeft: tokens };
    });
}
exports.consumeToken = consumeToken;
//# sourceMappingURL=tokenBucket.js.map