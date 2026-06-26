/**
 * Email channel adapter (SRS §10.2) — wraps the on-prem SMTP mailer. The dispatcher owns the
 * notification-row lifecycle and retries; this adapter only performs the transport send and
 * surfaces the SMTP message id. Throwing on failure is intentional: it drives the retry path.
 */
import type { Attachment } from 'nodemailer/lib/mailer';
import type { ChannelAdapter, RenderedMessage } from '../dispatcher.ts';
import { sendMail } from '../../email/mailer.ts';

export const emailChannel: ChannelAdapter = {
  channel: 'email',
  async send(recipient: string, message: RenderedMessage) {
    const attachments: Attachment[] | undefined = message.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      cid: a.cid,
    }));
    const providerMessageId = await sendMail({
      to: recipient,
      subject: message.subject ?? '',
      html: message.html ?? `<p>${message.text}</p>`,
      text: message.text,
      attachments,
    });
    return { providerMessageId };
  },
};
