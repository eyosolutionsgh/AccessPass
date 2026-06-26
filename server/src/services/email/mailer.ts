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
};

/** Send an email; notification failures are surfaced to the caller (SRS FR-074, NFR-AVL-02). */
export async function sendMail(input: SendMailInput): Promise<string> {
  const info = await mailer.sendMail({ from: env.SMTP_FROM, ...input });
  logger.debug({ messageId: info.messageId, to: input.to }, 'email sent');
  return info.messageId;
}
