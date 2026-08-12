// Lightweight in-memory rate limiter for API routes. Per-IP and optional
// per-key (e.g. userId) sliding buckets. In-memory = per server instance;
// on serverless (Vercel) it's per-warm-instance — a documented best-effort
// guard, not a hard global limit (use Vercel WAF / Upstash for global).

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** GC sweep — drop expired buckets. */
function sweep(now: number) {
  if (buckets.size < 1000) return; // keep it cheap for small apps
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

/**
 * Returns true if the key is over its limit (caller should reject with 429).
 * @param key unique key, e.g. `ip:${ip}` or `user:${userId}`
 * @param limit max requests per window
 * @param windowMs window length in ms
 */
export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  b.count += 1;
  return b.count > limit;
}

/** Best-effort client IP extraction from common proxy headers. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
