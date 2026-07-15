import { env } from '../../env.ts';
import { logger } from '../../logger.ts';

/**
 * Email transport — the MailerSend HTTP API (transactional). SMTP is not used: mail is POSTed to
 * https://api.mailersend.com/v1/email with a Bearer API token, which sidesteps outbound SMTP-port
 * blocks on the host. The sender address is always MAILERSEND_FROM_EMAIL (a MailerSend-verified
 * domain, so DKIM/SPF align); a `from` override only changes the display NAME.
 */
const MAILERSEND_API_URL = 'https://api.mailersend.com/v1/email';
const SEND_TIMEOUT_MS = 30_000;

/**
 * Attachment for {@link sendMail}. `content` is a Buffer (or an already-base64 string); a `cid`
 * marks an inline image referenced in the HTML as `<img src="cid:CID">` (MailerSend maps it via the
 * attachment `id` + `disposition: inline`).
 */
export type MailAttachment = {
  filename: string;
  content: Buffer | string;
  cid?: string;
};

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
  /**
   * Optional sender override — only the display NAME is honoured; the address is always
   * MAILERSEND_FROM_EMAIL (the verified domain). Defaults to MAILERSEND_FROM_NAME.
   */
  from?: string;
};

/**
 * Extract a display name from a `Name <addr>` (or bare) From string. The address is intentionally
 * ignored — MailerSend requires the verified-domain sender — so we keep only the name.
 */
function displayName(from?: string): string {
  if (!from) return env.MAILERSEND_FROM_NAME;
  const lt = from.indexOf('<');
  const raw = lt >= 0 ? from.slice(0, lt) : from;
  return raw.replace(/["\\\r\n]/g, '').trim() || env.MAILERSEND_FROM_NAME;
}

/**
 * Build a `"Display Name" <address>` string used by callers as the `from` override. Keeps the
 * verified MAILERSEND_FROM_EMAIL address while showing `name`.
 */
export function fromWithName(name: string): string {
  const safe = name.replace(/["\\\r\n]/g, '').trim();
  return `${safe || env.MAILERSEND_FROM_NAME} <${env.MAILERSEND_FROM_EMAIL}>`;
}

/**
 * Plain branding label in the form `Institution Name (Platform Name)` — e.g. `Jubilee House
 * (Visitor Management System)` — for email subjects, body captions and footer signatures.
 * Falls back to the platform name alone when no institution name is configured.
 */
export function institutionLabel(orgName: string): string {
  const inst = orgName?.trim();
  return inst ? `${inst} (${env.PLATFORM_NAME})` : env.PLATFORM_NAME;
}

/**
 * Sender display using {@link institutionLabel}, so recipients see both who invited them and the
 * product. The address stays MAILERSEND_FROM_EMAIL (DKIM/SPF intact).
 */
export function institutionFrom(orgName: string): string {
  return fromWithName(institutionLabel(orgName));
}

const toBase64 = (content: Buffer | string): string =>
  Buffer.isBuffer(content) ? content.toString('base64') : content;

/** Send an email via the MailerSend API. Throws on failure (drives the notification retry path). */
export async function sendMail(input: SendMailInput): Promise<string> {
  if (!env.MAILERSEND_API_TOKEN) {
    throw new Error('MAILERSEND_API_TOKEN is not configured — cannot send email');
  }

  const body: Record<string, unknown> = {
    from: { email: env.MAILERSEND_FROM_EMAIL, name: displayName(input.from) },
    to: [{ email: input.to }],
    subject: input.subject,
    html: input.html,
  };
  if (input.text) body.text = input.text;
  if (input.attachments?.length) {
    body.attachments = input.attachments.map((a) => ({
      filename: a.filename,
      content: toBase64(a.content),
      disposition: a.cid ? 'inline' : 'attachment',
      ...(a.cid ? { id: a.cid } : {}),
    }));
  }

  const res = await fetch(MAILERSEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MAILERSEND_API_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`MailerSend send failed (${res.status}): ${detail.slice(0, 500)}`);
  }

  // MailerSend returns 202 Accepted with the id in the X-Message-Id header (body is empty).
  const messageId = res.headers.get('x-message-id') ?? '';
  logger.debug({ messageId, to: input.to }, 'email sent');
  return messageId;
}
