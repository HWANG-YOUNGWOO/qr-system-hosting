"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAndIncrement = void 0;
const firestore_1 = require("firebase-admin/firestore");
const db = (0, firestore_1.getFirestore)();
/**
 * Fixed-window rate limiter using Firestore transactions.
 * key: string - unique key for limiter (e.g., phoneKey or ipHash)
 * limit: number - max requests per window
 * windowMs: number - window size in milliseconds
 */
async function checkAndIncrement(key, limit, windowMs) {
    const docRef = db.collection('rateLimits').doc(key);
    const now = Date.now();
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists) {
            tx.set(docRef, { count: 1, windowStart: now, windowEnd: now + windowMs });
            return { allowed: true, remaining: limit - 1 };
        }
        const data = snap.data();
        if (now > data.windowEnd) {
            // reset window
            tx.set(docRef, { count: 1, windowStart: now, windowEnd: now + windowMs });
            return { allowed: true, remaining: limit - 1 };
        }
        if (data.count >= limit) {
            return { allowed: false, nextAllowedAt: data.windowEnd };
        }
        tx.update(docRef, { count: data.count + 1 });
        return { allowed: true, remaining: limit - (data.count + 1) };
    });
}
exports.checkAndIncrement = checkAndIncrement;
//# sourceMappingURL=rateLimiter.js.map