import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import { env } from '../../env.ts';
import { logger } from '../../logger.ts';

/**
 * SMTP transport pointed at the corporate relay (SRS §10.2, on-prem). Auth is omitted when
 * SMTP_USER is blank (e.g. the local Mailpit dev sink).
 */
export const mailer = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
  /** Optional sender override (e.g. to show the institution name); defaults to SMTP_FROM. */
  from?: string;
};

/**
 * Build a `From` header that keeps the configured sender address (for SPF/DKIM/deliverability) but
 * shows `displayName` so recipients recognise the institution. Reuses the address parsed from
 * SMTP_FROM, which may be either `Name <addr@host>` or a bare `addr@host`.
 */
export function fromWithName(displayName: string): string {
  const match = env.SMTP_FROM.match(/<([^>]+)>/);
  const address = (match?.[1] ?? env.SMTP_FROM).trim();
  // Quote the display name and strip characters that could break the header.
  const safe = displayName.replace(/["\\\r\n]/g, '').trim();
  return safe ? `"${safe}" <${address}>` : env.SMTP_FROM;
}

/** Send an email; notification failures are surfaced to the caller (SRS FR-074, NFR-AVL-02). */
export async function sendMail(input: SendMailInput): Promise<string> {
  const { from, ...rest } = input;
  const info = await mailer.sendMail({ from: from ?? env.SMTP_FROM, ...rest });
  logger.debug({ messageId: info.messageId, to: input.to }, 'email sent');
  return info.messageId;
}
