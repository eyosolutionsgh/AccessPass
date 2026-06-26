import { Redis } from 'ioredis';
import { env } from './env.ts';

/**
 * Shared Redis connection — cache, rate-limit store, and (later) the BullMQ job queue.
 * `maxRetriesPerRequest: null` keeps it compatible with BullMQ blocking commands.
 */
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
