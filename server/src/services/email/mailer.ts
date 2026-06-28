import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import { env } from '../../env.ts';
import { logger } from '../../logger.ts';

/**
 * SMTP transport pointed at the corporate relay (SRS §10.2, on-prem). Auth is omitted when
 * SMTP_USER is blank (e.g. the local Mailpit dev sink).
 *
 * The relay is reached on the submission port (587, `SMTP_SECURE=false`): the connection starts
 * plaintext and upgrades via STARTTLS. We force STARTTLS whenever credentials are configured so the
 * login is never sent in the clear — but only then, since the dev Mailpit sink offers no TLS.
 * (Implicit-TLS port 465 is firewall-blocked outbound on the Hetzner host, so 587 is the only path.)
 * Timeouts keep a wedged relay from hanging the request that triggered the send.
 */
export const mailer = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  requireTLS: env.SMTP_USER ? !env.SMTP_SECURE : false,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 30_000,
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

/**
 * Plain branding label in the form `Institution Name (Platform Name)` — e.g. `Jubilee House
 * (Visitor Management System)` — for use in email subjects, body captions and footer signatures.
 * Falls back to the platform name alone when no institution name is configured.
 */
export function institutionLabel(orgName: string): string {
  const inst = orgName?.trim();
  return inst ? `${inst} (${env.PLATFORM_NAME})` : env.PLATFORM_NAME;
}

/**
 * Sender display using {@link institutionLabel}, so recipients see both who invited them and the
 * product. Keeps the configured SMTP_FROM address (DKIM/SPF intact).
 */
export function institutionFrom(orgName: string): string {
  return fromWithName(institutionLabel(orgName));
}

/** Send an email; notification failures are surfaced to the caller (SRS FR-074, NFR-AVL-02). */
export async function sendMail(input: SendMailInput): Promise<string> {
  const { from, ...rest } = input;
  const info = await mailer.sendMail({ from: from ?? env.SMTP_FROM, ...rest });
  logger.debug({ messageId: info.messageId, to: input.to }, 'email sent');
  return info.messageId;
}
