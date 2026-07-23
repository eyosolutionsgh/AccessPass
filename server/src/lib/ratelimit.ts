import { redis } from '../redis.ts';
import { logger } from '../logger.ts';

export type RateLimitResult = { allowed: boolean; count: number; remaining: number };

/**
 * Fixed-window rate limiter backed by Redis (SRS QR-SEC-01 — throttle code/QR validation by
 * IP, device, kiosk, or session). Returns the current count so callers can escalate (e.g.
 * raise a security alert) after a threshold.
 *
 * Fails **open**: if Redis is unreachable (e.g. a managed Upstash blip on the serverless demo) the
 * request is allowed rather than 500'd. Throttling is a defence-in-depth control, not a correctness
 * gate, so a rate-limiter outage must never take the whole API down.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  try {
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds);
    return { allowed: count <= limit, count, remaining: Math.max(0, limit - count) };
  } catch (err) {
    logger.warn({ err, key }, 'rate limiter unavailable — failing open');
    return { allowed: true, count: 0, remaining: limit };
  }
}
