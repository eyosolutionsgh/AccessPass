/**
 * Email channel adapter (SRS §10.2) — wraps the MailerSend API mailer. The dispatcher owns the
 * notification-row lifecycle and retries; this adapter only performs the transport send and
 * surfaces the provider message id. Throwing on failure is intentional: it drives the retry path.
 */
import type { ChannelAdapter, RenderedMessage } from '../dispatcher.ts';
import { sendMail } from '../../email/mailer.ts';

export const emailChannel: ChannelAdapter = {
  channel: 'email',
  async send(recipient: string, message: RenderedMessage) {
    // RenderedMessage attachments are { filename, content: Buffer, cid } — the MailAttachment shape.
    const providerMessageId = await sendMail({
      to: recipient,
      subject: message.subject ?? '',
      html: message.html ?? `<p>${message.text}</p>`,
      text: message.text,
      attachments: message.attachments,
      from: message.from,
    });
    return { providerMessageId };
  },
};
