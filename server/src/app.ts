import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { toNodeHandler } from 'better-auth/node';
import cors from 'cors';
import { sql } from 'drizzle-orm';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { auth } from './auth.ts';
import { db } from './db.ts';
import { env } from './env.ts';
import { errorHandler } from './lib/http-errors.ts';
import { logger } from './logger.ts';
import { mcpRouter } from './mcp/http.ts';
import { redis } from './redis.ts';
import { internalRouter } from './rest/internal.ts';
import { restRouter } from './rest/index.ts';
import { reportExportRouter } from './rest/reports.ts';
import { createContext } from './trpc/context.ts';
import { appRouter } from './trpc/routers/index.ts';

/**
 * Build the configured Express app — every route and middleware, but no transport (no `createServer`,
 * Socket.IO, BullMQ, or `listen`). Shared by both entrypoints: `index.ts` wraps it in a long-running
 * HTTP server + Socket.IO + BullMQ (on-prem), and `serverless.ts` hands it straight to a Vercel
 * Function as a `(req, res)` handler.
 */
export function createApp(): Express {
  const app = express();

  // On-prem the API sits behind a reverse proxy (nginx/Caddy); on Vercel behind its edge. Trust it
  // for client IPs.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(pinoHttp({ logger }));
  app.use(cors({ origin: [env.WEB_ORIGIN, env.APP_URL], credentials: true }));

  // better-auth must be mounted BEFORE express.json() so it can read the raw request body.
  app.all('/api/auth/*', toNodeHandler(auth));

  // Internal routes (QStash callbacks + Ably token) are mounted before express.json() too: the QStash
  // callbacks verify a signature over their raw body. The router only claims specific sub-paths and
  // calls next() for everything else under /api, so /api/v1 and /api/reports still reach their
  // handlers below.
  app.use('/api', internalRouter);

  // 8mb accommodates base64 ID-document images for AI extraction (B1); JSON elsewhere is tiny.
  app.use(express.json({ limit: '8mb' }));

  // Baseline API rate limit (per-endpoint stricter limits — e.g. QR-SEC-01 — added later).
  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }),
  );

  // Liveness — process is up.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'vms-server', time: new Date().toISOString() });
  });

  // Readiness — dependencies reachable (SRS NFR-AVL).
  app.get('/ready', async (_req, res) => {
    const [dbResult, redisResult] = await Promise.allSettled([
      db.execute(sql`select 1`),
      redis.ping(),
    ]);
    const dbOk = dbResult.status === 'fulfilled';
    const redisOk = redisResult.status === 'fulfilled';
    res.status(dbOk && redisOk ? 200 : 503).json({ db: dbOk, redis: redisOk });
  });

  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext,
      // Funnel server-side faults into pino. tRPC wraps any non-TRPCError throw as
      // INTERNAL_SERVER_ERROR, so that code (plus `unknown` type) flags genuine bugs; expected
      // client errors (auth/validation/rate-limit) only get a debug line. Never log `input`: it
      // can carry invite codes / QR tokens (QR-SEC-02) that pino's field redaction can't reach.
      onError({ error, type, path }) {
        if (error.code === 'INTERNAL_SERVER_ERROR') {
          logger.error({ err: error.cause ?? error, type, path }, 'tRPC handler error');
        } else {
          logger.debug({ code: error.code, type, path }, 'tRPC client error');
        }
      },
    }),
  );

  app.use('/api/v1', restRouter);
  app.use('/api/reports', reportExportRouter);
  app.use('/mcp', mcpRouter);

  // Terminal error handler — must sit after every route so thrown/forwarded errors reach pino.
  app.use(errorHandler);

  return app;
}
