import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../logger.ts';
import { asyncHandler, errorHandler } from './http-errors.ts';

// Mock the structured logger so the suite stays quiet AND we can assert errors are actually
// funnelled into pino — not merely that a 500 is returned.
vi.mock('../logger.ts', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn(), fatal: vi.fn() },
}));

const loggedError = vi.mocked(logger.error);

function appWith(handler: RequestHandler) {
  const app = express();
  app.get('/boom', handler);
  app.use(errorHandler); // terminal handler, after the route
  return app;
}

describe('Express error funnel (http-errors)', () => {
  beforeEach(() => loggedError.mockClear());

  it('forwards async route rejections to the error handler (Express 4 needs asyncHandler)', async () => {
    const app = appWith(
      asyncHandler(async () => {
        await Promise.resolve();
        throw new Error('async boom: invite code VX7K9Q');
      }),
    );

    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    // Generic body — no internals or PII leaked (SRS §11.2).
    expect(res.body).toEqual({ error: 'internal server error' });
    expect(res.text).not.toContain('VX7K9Q');
    // The real error reached pino with its stack intact.
    expect(loggedError).toHaveBeenCalledTimes(1);
    const [firstArg] = loggedError.mock.calls[0] ?? [];
    expect(firstArg).toMatchObject({ err: expect.any(Error) });
  });

  it('catches synchronous throws as well', async () => {
    const app = appWith(() => {
      throw new Error('sync boom');
    });

    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal server error' });
    expect(loggedError).toHaveBeenCalledTimes(1);
  });

  it('lets successful async routes respond normally and logs nothing', async () => {
    const app = appWith(
      asyncHandler(async (_req, res) => {
        res.json({ ok: true });
      }),
    );

    const res = await request(app).get('/boom');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(loggedError).not.toHaveBeenCalled();
  });
});
