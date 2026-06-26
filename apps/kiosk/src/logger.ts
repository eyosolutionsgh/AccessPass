import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { multistream, pino, type StreamEntry } from 'pino';

/**
 * Structured logging for the kiosk main process. Mirrors the server's pino setup so kiosk crashes
 * are captured the same way — on-prem, no Sentry/cloud. Writes to stdout (visible to whatever
 * launches the kiosk) and, when reachable, to a file under Electron's per-user logs directory so a
 * locked-down kiosk with no attached console still leaves a trail.
 */
function buildStreams(): StreamEntry[] {
  const streams: StreamEntry[] = [{ stream: process.stdout }];
  try {
    const dir = app.getPath('logs');
    mkdirSync(dir, { recursive: true });
    streams.push({ stream: createWriteStream(join(dir, 'kiosk.log'), { flags: 'a' }) });
  } catch {
    // logs path not resolvable yet (e.g. before app name is known) — stdout-only is fine.
  }
  return streams;
}

export const logger = pino(
  { level: process.env.KIOSK_LOG_LEVEL || 'info', base: { proc: 'kiosk-main' } },
  multistream(buildStreams()),
);
