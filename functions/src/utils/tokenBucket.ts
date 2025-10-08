export interface TokenBucketResult {
  allowed: boolean;
  tokensLeft?: number;
  retryAfterMs?: number;
}

/**
 * token bucket stored per key in Firestore. Document shape:
 * { tokens: number, lastRefillTs: number, capacity: number, refillRateMsPerToken: number }
 */
export async function consumeToken(key: string, capacity: number, refillMsPerToken: number): Promise<TokenBucketResult> {
  // Lazy-import Firestore so we don't call getFirestore() at module-load time.
  // That prevents "default Firebase app does not exist" errors when the
  // functions runtime initializes firebase-admin later.
  const { getFirestore } = await import('firebase-admin/firestore');
  const db = getFirestore();
  const docRef = db.collection('tokenBuckets').doc(key);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) {
      tx.set(docRef, { tokens: capacity - 1, lastRefillTs: now, capacity, refillMsPerToken });
      return { allowed: true, tokensLeft: capacity - 1 };
    }

    const data = snap.data() as { tokens: number; lastRefillTs: number; capacity: number; refillMsPerToken: number };
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
