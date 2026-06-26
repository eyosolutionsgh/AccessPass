import { redis } from '../redis.ts';

export type RateLimitResult = { allowed: boolean; count: number; remaining: number };

/**
 * Fixed-window rate limiter backed by Redis (SRS QR-SEC-01 — throttle code/QR validation by
 * IP, device, kiosk, or session). Returns the current count so callers can escalate (e.g.
 * raise a security alert) after a threshold.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) await redis.expire(redisKey, windowSeconds);
  return { allowed: count <= limit, count, remaining: Math.max(0, limit - count) };
}
