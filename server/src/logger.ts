import { pino } from 'pino';
import { env } from './env.ts';

/**
 * Structured logger with secret redaction (SRS QR-SEC-07 / §11.2): tokens, codes, passwords,
 * cookies, and auth headers must never be written in plain text.
 */
export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.codeHash',
      '*.qrTokenHash',
      '*.qrBadgeTokenHash',
      '*.idReferenceEnc',
    ],
    censor: '[redacted]',
  },
  transport:
    env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
});
