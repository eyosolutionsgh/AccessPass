import { sql } from 'drizzle-orm';
import { db } from '../../db.ts';
import { redis } from '../../redis.ts';
import { publicProcedure, router } from '../trpc.ts';

export const healthRouter = router({
  ping: publicProcedure.query(() => ({ status: 'ok' as const, time: new Date().toISOString() })),

  ready: publicProcedure.query(async () => {
    const [dbResult, redisResult] = await Promise.allSettled([
      db.execute(sql`select 1`),
      redis.ping(),
    ]);
    return {
      db: dbResult.status === 'fulfilled',
      redis: redisResult.status === 'fulfilled',
    };
  }),
});
