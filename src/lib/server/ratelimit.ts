import { ApiError } from "./errors";

type Bucket = { tokens: number; updated: number };
const store = globalThis as unknown as { __rl?: Map<string, Bucket> };
const buckets = (store.__rl ??= new Map());

/** In-process token bucket. Sufficient for the single-node deployment described in the README. */
export function rateLimit(key: string, capacity: number, refillPerMinute: number) {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: capacity, updated: now };
  b.tokens = Math.min(capacity, b.tokens + ((now - b.updated) / 60000) * refillPerMinute);
  b.updated = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    throw new ApiError(429, "rate_limited", "Slow down. Too many requests.");
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 50000) for (const [k, v] of buckets) if (now - v.updated > 3600000) buckets.delete(k);
}
