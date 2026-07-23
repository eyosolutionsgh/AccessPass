import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../env.ts';
import { isServerless } from '../runtime.ts';
import { logger } from '../logger.ts';
import { runExpirySweep } from '../services/credentials.ts';
import { runRetentionSweep } from '../services/retention.ts';
import type { NotificationJobData } from '../services/notifications/dispatcher.ts';

const QUEUE_NAME = 'vms-maintenance';

/**
 * BullMQ connection + queue are created **lazily** and **never on serverless**. A BullMQ Worker/Queue
 * holds a blocking Redis connection that a request-scoped Vercel function cannot host, and importing
 * this module must not open one as a side effect (the notification dispatcher and security service
 * `import()` it dynamically just to enqueue a retry). On serverless the repeatable sweeps run via
 * Upstash QStash callbacks (lib/qstash.ts) and the retry/embed enqueues below become no-ops — the
 * initial attempt still runs inline; only the durable retry layer is dropped. On-prem, everything
 * below behaves exactly as before.
 */
let connection: Redis | null = null;
let queue: Queue | null = null;
let worker: Worker | null = null;

function getQueue(): Queue | null {
  if (isServerless) return null;
  if (!queue) {
    // Dedicated connection for BullMQ (its workers issue blocking commands, so it must not share
    // the app's general-purpose client). On-prem we run the worker in-process.
    connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    queue = new Queue(QUEUE_NAME, { connection });
  }
  return queue;
}

/** Start the in-process worker that runs background maintenance jobs (SRS FR-053/083/104). */
export function startMaintenanceWorker(): Worker | null {
  if (isServerless) return null;
  getQueue(); // ensures `connection` exists
  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === 'expiry-sweep') return runExpirySweep();
      if (job.name === 'retention-sweep') return runRetentionSweep();
      if (job.name === 'notification-send') {
        // Dynamic import avoids a static cycle (dispatcher schedules retries onto this queue).
        const { processNotificationJob } = await import('../services/notifications/dispatcher.ts');
        return processNotificationJob(job.data as NotificationJobData);
      }
      if (job.name === 'incident-embed') {
        const { isEmbeddingEnabled } = await import('../services/ai/client.ts');
        if (!isEmbeddingEnabled()) return undefined; // AI disabled → skip (no error, no retry)
        const { embedIncident } = await import('../services/ai/analyst.ts');
        return embedIncident((job.data as { incidentId: string }).incidentId);
      }
      return undefined;
    },
    { connection: connection! },
  );
  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err }, 'maintenance job failed'),
  );
  return worker;
}

/** Register the repeatable sweeps (BullMQ dedupes by name + repeat options). */
export async function scheduleMaintenance(): Promise<void> {
  const q = getQueue();
  if (!q) return; // serverless: QStash schedules these instead (lib/qstash.ts)
  await q.add(
    'expiry-sweep',
    {},
    { repeat: { every: 60_000 }, removeOnComplete: true, removeOnFail: 50 },
  );
  // Retention/anonymization runs daily (SRS FR-104).
  await q.add(
    'retention-sweep',
    {},
    { repeat: { every: 24 * 60 * 60_000 }, removeOnComplete: true, removeOnFail: 10 },
  );
}

/** Schedule a one-shot delayed notification retry (called by the dispatcher's backoff path). */
export async function enqueueNotificationRetry(
  data: NotificationJobData,
  delayMs: number,
): Promise<void> {
  const q = getQueue();
  if (!q) {
    logger.debug('serverless: notification retry queue disabled — send was best-effort inline');
    return;
  }
  await q.add('notification-send', data, {
    delay: delayMs,
    removeOnComplete: true,
    removeOnFail: 100,
  });
}

/** Schedule embedding of a newly-raised incident (best-effort; BullMQ retries transient failures). */
export async function enqueueIncidentEmbed(incidentId: string): Promise<void> {
  const q = getQueue();
  if (!q) {
    logger.debug({ incidentId }, 'serverless: incident-embed queue disabled');
    return;
  }
  await q.add(
    'incident-embed',
    { incidentId },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
}

export async function stopMaintenance(): Promise<void> {
  await worker?.close();
  await queue?.close();
  connection?.disconnect();
}
