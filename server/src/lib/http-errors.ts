import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express';
import { logger } from '../logger.ts';

/**
 * Express 4 does NOT forward rejected promises from async route handlers to error-handling
 * middleware — an unhandled rejection escapes the request entirely (hung response, only caught
 * by the process-level `unhandledRejection` funnel). Wrap async handlers so their failures reach
 * {@link errorHandler} with the request still in scope.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/**
 * Terminal Express error handler — mount AFTER all routes. Captures anything thrown (or passed to
 * `next(err)`) by the REST gateway / better-auth so it lands in pino instead of vanishing, and
 * returns a generic 500 (no internals leaked — SRS §11.2). Uses the per-request child logger from
 * pino-http when present so the entry carries the request id/context.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const log = (req as Request & { log?: typeof logger }).log ?? logger;
  log.error({ err, method: req.method, url: req.originalUrl }, 'unhandled request error');
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json({ error: 'internal server error' });
};
