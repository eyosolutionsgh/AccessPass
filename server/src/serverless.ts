import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app.ts';
import { ensureQstashSchedules } from './lib/qstash.ts';
import { logger } from './logger.ts';

/**
 * Vercel-only entrypoint. `src/index.ts` (the on-prem/any-VM bootstrap, a long-running
 * `server.listen()` with Socket.IO + BullMQ) is untouched and stays the entrypoint everywhere else —
 * this file exists because a Vercel Function is request-scoped and cannot hold an open listener,
 * a Socket.IO server, or a BullMQ worker.
 *
 * A Vercel Node Function is invoked as a plain `(req, res)` handler — the exact shape an Express app
 * already is — so no Lambda-style event/context adapter is needed; the app is passed straight
 * through. It is built once and cached at module scope so it survives across invocations of the same
 * warm instance instead of re-bootstrapping on every request.
 */
type HttpHandler = (req: IncomingMessage, res: ServerResponse) => void;

let cachedHandler: HttpHandler | undefined;

function bootstrap(): HttpHandler {
  const app = createApp();
  // Idempotent: (re)register the QStash cron schedules that drive the maintenance sweeps on
  // serverless (the BullMQ worker that does this on-prem never starts here). Fire-and-forget.
  void ensureQstashSchedules().catch((err) =>
    logger.warn({ err }, 'ensureQstashSchedules failed at bootstrap'),
  );
  return app as unknown as HttpHandler;
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!cachedHandler) cachedHandler = bootstrap();
  cachedHandler(req, res);
}
