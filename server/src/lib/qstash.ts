import { Client, Receiver } from '@upstash/qstash';
import { env } from '../env.ts';
import { logger } from '../logger.ts';

/**
 * Upstash QStash — the serverless (Vercel) replacement for the on-prem BullMQ repeatable sweeps.
 * QStash cron schedules POST back to signed callback routes (rest/internal.ts) which run the same
 * sweep functions. On-prem leaves `QSTASH_*` unset and the in-process BullMQ worker runs instead;
 * this whole module then stays inert. Mirrors the Klasio deployment's `common/qstash.ts`.
 */
export function qstashConfigured(): boolean {
  return !!env.QSTASH_TOKEN && !!env.QSTASH_CURRENT_SIGNING_KEY;
}

let client: Client | null = null;
function qstashClient(): Client {
  if (!client) client = new Client({ token: env.QSTASH_TOKEN! });
  return client;
}

let receiver: Receiver | null = null;
function qstashReceiver(): Receiver | null {
  if (!env.QSTASH_CURRENT_SIGNING_KEY) return null;
  if (!receiver) {
    receiver = new Receiver({
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY ?? '',
    });
  }
  return receiver;
}

/** Verify a QStash callback's `Upstash-Signature`. Fails closed (unsigned/invalid ⇒ false). */
export async function verifyQstashSignature(
  signature: string | undefined,
  body: string,
): Promise<boolean> {
  const r = qstashReceiver();
  if (!r || !signature) return false;
  try {
    return await r.verify({ signature, body });
  } catch {
    return false;
  }
}

/**
 * Idempotently (re)register the maintenance cron schedules. Deterministic `scheduleId`s mean create
 * overwrites rather than duplicating, so re-running on every cold start is safe. The bodies are empty
 * (the callbacks take no payload), so the signed body QStash sends is the empty string.
 */
export async function ensureQstashSchedules(): Promise<void> {
  if (!qstashConfigured() || !env.API_PUBLIC_URL) {
    logger.debug('qstash not configured (or no API_PUBLIC_URL) — skipping schedule registration');
    return;
  }
  const base = env.API_PUBLIC_URL.replace(/\/+$/, '');
  const c = qstashClient();
  try {
    await c.schedules.create({
      destination: `${base}/api/internal/qstash/expiry-sweep`,
      scheduleId: 'vms-expiry-sweep',
      cron: '* * * * *', // every minute — matches the on-prem 60s BullMQ repeat
    });
    await c.schedules.create({
      destination: `${base}/api/internal/qstash/retention-sweep`,
      scheduleId: 'vms-retention-sweep',
      cron: '0 2 * * *', // daily at 02:00 (SRS FR-104 retention/anonymization)
    });
    logger.info('qstash maintenance schedules ensured');
  } catch (err) {
    // Non-fatal: the demo still serves requests; sweeps just won't fire until this succeeds.
    logger.warn({ err }, 'failed to register qstash schedules');
  }
}
