/**
 * Unified notification dispatcher (SRS §10.2, FR-074).
 *
 * Single seam for sending host/visitor/security notifications across channels. Replaces the
 * notification-row lifecycle that was previously hand-duplicated in `invitations.ts` and
 * `checkin.ts` (insert → try send → set sent/failed). New channels (SMS, internal chat) and
 * two-way responses attach here rather than at every call site.
 *
 * Delivery model — synchronous first attempt, durable retry:
 *  - The happy path sends inline, so the message goes out within the request and the row reflects
 *    `sent`/`failed` immediately (unchanged behaviour vs. the old inline code).
 *  - On a transient failure the row is left `queued`, `nextRetryAt` is recorded, and a one-shot
 *    delayed BullMQ job re-attempts with exponential backoff up to MAX_ATTEMPTS.
 *  - Notification failures NEVER throw into the business path (SRS NFR-AVL-02) — issuance and
 *    check-in must not be blocked by a mail/gateway outage.
 *
 * Air-gap: every channel adapter targets on-prem infrastructure (SMTP relay today). Retry
 * scheduling is best-effort — if Redis is momentarily unavailable the first attempt still went out.
 */
import { eq } from 'drizzle-orm';
import { schema } from '@vms/shared';
import { db } from '../../db.ts';
import { logger } from '../../logger.ts';
import { emailChannel } from './channels/email.ts';
import { smsChannel } from './channels/sms.ts';
import { chatChannel } from './channels/chat.ts';

export type NotificationChannelName = (typeof schema.notificationChannel.enumValues)[number];
export type NotificationStatus = (typeof schema.notificationStatus.enumValues)[number];

/** A delivery-ready message. `text` is mandatory (SMS/plain fallback); email also uses subject/html. */
export type NotificationAttachment = { filename: string; content: Buffer; cid?: string };
export type RenderedMessage = {
  subject?: string;
  html?: string;
  text: string;
  attachments?: NotificationAttachment[];
  /** Optional sender override (e.g. an institution-branded From); defaults to MAILERSEND_FROM_*. */
  from?: string;
};

export interface ChannelAdapter {
  readonly channel: NotificationChannelName;
  /** Deliver the message. Resolve with an optional provider id; THROW on failure (drives retry). */
  send(recipient: string, message: RenderedMessage): Promise<{ providerMessageId?: string }>;
}

export type DispatchInput = {
  visitId?: string | null;
  recipient: string;
  channel: NotificationChannelName;
  template: string;
  message: RenderedMessage;
};

/** Serializable form carried in the BullMQ retry job (Buffers → base64 for JSON transport). */
type SerializedAttachment = { filename: string; contentBase64: string; cid?: string };
type SerializedMessage = {
  subject?: string;
  html?: string;
  text: string;
  attachments?: SerializedAttachment[];
  from?: string;
};
export type NotificationJobData = {
  notificationId: string;
  channel: NotificationChannelName;
  recipient: string;
  message: SerializedMessage;
};

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 30 * 60_000;

// Email is always available; SMS/chat register only when configured (adapter is null otherwise),
// matching the codebase's optional-integration pattern — an unconfigured channel stays unregistered
// and a dispatch to it is recorded as failed ("no adapter"), never silently dropped.
const channels = new Map<NotificationChannelName, ChannelAdapter>();
for (const adapter of [emailChannel, smsChannel, chatChannel]) {
  if (adapter) channels.set(adapter.channel, adapter);
}

/** Register/override a channel adapter (used by additional providers and by tests). */
export function registerChannel(adapter: ChannelAdapter): void {
  channels.set(adapter.channel, adapter);
}

/** Whether a channel is configured/registered — lets callers skip dispatching to disabled channels
 * (which would otherwise record a `failed` "no adapter" row). */
export function isChannelAvailable(channel: NotificationChannelName): boolean {
  return channels.has(channel);
}

function backoffMs(attemptNo: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** (attemptNo - 1), MAX_BACKOFF_MS);
}

function serializeMessage(message: RenderedMessage): SerializedMessage {
  return {
    subject: message.subject,
    html: message.html,
    text: message.text,
    from: message.from,
    attachments: message.attachments?.map((a) => ({
      filename: a.filename,
      contentBase64: a.content.toString('base64'),
      cid: a.cid,
    })),
  };
}

function deserializeMessage(message: SerializedMessage): RenderedMessage {
  return {
    subject: message.subject,
    html: message.html,
    text: message.text,
    from: message.from,
    attachments: message.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.contentBase64, 'base64'),
      cid: a.cid,
    })),
  };
}

/**
 * Persist a notification row and make the first delivery attempt. Returns the row id + status.
 * Never throws — a failure to record or send is logged and reported as `failed`.
 */
export async function dispatch(
  input: DispatchInput,
): Promise<{ notificationId: string | null; status: NotificationStatus }> {
  try {
    const [notif] = await db
      .insert(schema.notification)
      .values({
        visitId: input.visitId ?? null,
        recipient: input.recipient,
        channel: input.channel,
        template: input.template,
        status: 'queued',
      })
      .returning({ id: schema.notification.id });
    if (!notif) {
      logger.error(
        { channel: input.channel, recipient: input.recipient },
        'notification row insert returned nothing',
      );
      return { notificationId: null, status: 'failed' };
    }
    const status = await attemptDelivery(notif.id, input.channel, input.recipient, input.message);
    return { notificationId: notif.id, status };
  } catch (err) {
    logger.error({ err, channel: input.channel }, 'notification dispatch failed');
    return { notificationId: null, status: 'failed' };
  }
}

/**
 * Attempt delivery once, updating the row's status/attemptCount. On a retryable failure the row is
 * left `queued`, `nextRetryAt` is recorded, and a delayed retry job is scheduled (best-effort).
 * Idempotent: a row already `sent`/`delivered` is left untouched (covers duplicate retry jobs).
 */
export async function attemptDelivery(
  notificationId: string,
  channel: NotificationChannelName,
  recipient: string,
  message: RenderedMessage,
): Promise<NotificationStatus> {
  const [row] = await db
    .select({ attemptCount: schema.notification.attemptCount, status: schema.notification.status })
    .from(schema.notification)
    .where(eq(schema.notification.id, notificationId));
  if (!row) {
    logger.error({ notificationId }, 'notification row not found for delivery');
    return 'failed';
  }
  if (row.status === 'sent' || row.status === 'delivered') return row.status;

  const attemptNo = row.attemptCount + 1;
  const adapter = channels.get(channel);
  if (!adapter) {
    await db
      .update(schema.notification)
      .set({
        status: 'failed',
        attemptCount: attemptNo,
        failureReason: `no adapter registered for channel "${channel}"`,
        nextRetryAt: null,
      })
      .where(eq(schema.notification.id, notificationId));
    logger.error({ notificationId, channel }, 'no notification channel adapter registered');
    return 'failed';
  }

  try {
    const { providerMessageId } = await adapter.send(recipient, message);
    await db
      .update(schema.notification)
      .set({
        status: 'sent',
        sentAt: new Date(),
        attemptCount: attemptNo,
        providerMessageId: providerMessageId ?? null,
        failureReason: null,
        nextRetryAt: null,
      })
      .where(eq(schema.notification.id, notificationId));
    return 'sent';
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (attemptNo < MAX_ATTEMPTS) {
      const delay = backoffMs(attemptNo);
      await db
        .update(schema.notification)
        .set({
          status: 'queued',
          attemptCount: attemptNo,
          failureReason: reason,
          nextRetryAt: new Date(Date.now() + delay),
        })
        .where(eq(schema.notification.id, notificationId));
      await scheduleRetry({ notificationId, channel, recipient, message }, delay);
      logger.warn(
        { notificationId, channel, attemptNo, delay },
        'notification delivery failed; retry scheduled',
      );
      return 'queued';
    }
    await db
      .update(schema.notification)
      .set({ status: 'failed', attemptCount: attemptNo, failureReason: reason, nextRetryAt: null })
      .where(eq(schema.notification.id, notificationId));
    logger.error(
      { notificationId, channel, attemptNo },
      'notification delivery failed permanently',
    );
    return 'failed';
  }
}

/**
 * Schedule a delayed retry via the maintenance queue. Imported dynamically so neither the dispatcher
 * nor tests pull in the BullMQ/Redis connection unless a retry is actually needed. Never throws.
 */
async function scheduleRetry(
  job: {
    notificationId: string;
    channel: NotificationChannelName;
    recipient: string;
    message: RenderedMessage;
  },
  delayMs: number,
): Promise<void> {
  try {
    const { enqueueNotificationRetry } = await import('../../jobs/maintenance.ts');
    const data: NotificationJobData = {
      notificationId: job.notificationId,
      channel: job.channel,
      recipient: job.recipient,
      message: serializeMessage(job.message),
    };
    await enqueueNotificationRetry(data, delayMs);
  } catch (err) {
    logger.error(
      { err, notificationId: job.notificationId },
      'failed to schedule notification retry',
    );
  }
}

/** BullMQ `notification-send` job handler — invoked from the maintenance worker. */
export async function processNotificationJob(data: NotificationJobData): Promise<void> {
  await attemptDelivery(
    data.notificationId,
    data.channel,
    data.recipient,
    deserializeMessage(data.message),
  );
}
