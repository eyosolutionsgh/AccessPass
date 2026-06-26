import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../env.ts';
import { logger } from '../logger.ts';
import { runExpirySweep } from '../services/credentials.ts';
import { runRetentionSweep } from '../services/retention.ts';
import type { NotificationJobData } from '../services/notifications/dispatcher.ts';

const QUEUE_NAME = 'vms-maintenance';

/**
 * Dedicated Redis connection for BullMQ (its workers issue blocking commands, so it must not
 * share the app's general-purpose client). On-prem we run the worker in-process.
 */
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const maintenanceQueue = new Queue(QUEUE_NAME, { connection });

let worker: Worker | null = null;

/** Start the in-process worker that runs background maintenance jobs (SRS FR-053/083/104). */
export function startMaintenanceWorker(): Worker {
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
    { connection },
  );
  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err }, 'maintenance job failed'),
  );
  return worker;
}

/** Register the repeatable sweeps (BullMQ dedupes by name + repeat options). */
export async function scheduleMaintenance(): Promise<void> {
  await maintenanceQueue.add(
    'expiry-sweep',
    {},
    { repeat: { every: 60_000 }, removeOnComplete: true, removeOnFail: 50 },
  );
  // Retention/anonymization runs daily (SRS FR-104).
  await maintenanceQueue.add(
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
  await maintenanceQueue.add('notification-send', data, {
    delay: delayMs,
    removeOnComplete: true,
    removeOnFail: 100,
  });
}

/** Schedule embedding of a newly-raised incident (best-effort; BullMQ retries transient failures). */
export async function enqueueIncidentEmbed(incidentId: string): Promise<void> {
  await maintenanceQueue.add(
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
  await maintenanceQueue.close();
  connection.disconnect();
}
