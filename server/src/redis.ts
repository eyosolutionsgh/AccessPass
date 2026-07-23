import { Redis } from 'ioredis';
import { env } from './env.ts';
import { isServerless } from './runtime.ts';

/**
 * Shared Redis connection — rate-limit store and the `/ready` probe. (BullMQ uses its own dedicated
 * connection in jobs/maintenance.ts.)
 *
 * On-prem keeps `maxRetriesPerRequest: null` (unchanged). On serverless (Vercel → Upstash) it
 * connects lazily and uses a *finite* retry cap so a transient Upstash blip makes commands reject
 * quickly — the rate limiter catches that and fails open — instead of hanging the whole function.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: isServerless ? 3 : null,
  lazyConnect: isServerless,
});
