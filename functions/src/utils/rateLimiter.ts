import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

export interface RateLimitResult {
  allowed: boolean;
  nextAllowedAt?: number;
  remaining?: number;
}

/**
 * Fixed-window rate limiter using Firestore transactions.
 * key: string - unique key for limiter (e.g., phoneKey or ipHash)
 * limit: number - max requests per window
 * windowMs: number - window size in milliseconds
 */
export async function checkAndIncrement(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const docRef = db.collection('rateLimits').doc(key);
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) {
      tx.set(docRef, { count: 1, windowStart: now, windowEnd: now + windowMs });
      return { allowed: true, remaining: limit - 1 };
    }
    const data = snap.data() as { count: number; windowStart: number; windowEnd: number };
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
