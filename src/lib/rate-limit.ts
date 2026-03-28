interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

const MAX_TOKENS = 5;
const REFILL_INTERVAL_MS = 60_000; // 1 minute
const CLEANUP_INTERVAL_MS = 300_000; // 5 minutes

let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, bucket] of Array.from(buckets)) {
    if (now - bucket.lastRefill > REFILL_INTERVAL_MS * 2) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(key: string): {
  allowed: boolean;
  retryAfter?: number;
} {
  cleanup();

  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: MAX_TOKENS, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const tokensToAdd = Math.floor(elapsed / REFILL_INTERVAL_MS) * MAX_TOKENS;
  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  if (bucket.tokens > 0) {
    bucket.tokens--;
    return { allowed: true };
  }

  const retryAfter = Math.ceil(
    (REFILL_INTERVAL_MS - (now - bucket.lastRefill)) / 1000
  );
  return { allowed: false, retryAfter: Math.max(1, retryAfter) };
}
