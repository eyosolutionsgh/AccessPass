/**
 * Multi-channel fan-out for a single recipient (visitor or host). Sends the email variant when an
 * address is present and email is available, AND the SMS variant when a phone is present, the SMS
 * channel is configured, and the number is local to the configured country (the Nalo gateway
 * targets local subscribers). The channels are independent — one being unavailable, or a number
 * being non-local, never blocks the other. Delegates to dispatch(), so each send still gets a
 * notification row, retry, and status tracking.
 */
import { dispatch, isChannelAvailable, type NotificationAttachment } from './dispatcher.ts';
import { getCountry } from '../admin.ts';
import { isLocalNumber } from '../../lib/phone.ts';

export type ContactNotification = {
  visitId?: string | null;
  template: string;
  email?: {
    address?: string | null;
    subject: string;
    html: string;
    text: string;
    attachments?: NotificationAttachment[];
  };
  sms?: { phone?: string | null; text: string };
};

export async function notifyContact(input: ContactNotification): Promise<void> {
  const { visitId, template, email, sms } = input;

  if (email?.address && isChannelAvailable('email')) {
    await dispatch({
      visitId,
      recipient: email.address,
      channel: 'email',
      template,
      message: {
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: email.attachments,
      },
    });
  }

  if (sms?.phone && isChannelAvailable('sms')) {
    const country = await getCountry();
    if (isLocalNumber(sms.phone, country)) {
      await dispatch({
        visitId,
        recipient: sms.phone,
        channel: 'sms',
        template,
        message: { text: sms.text },
      });
    }
  }
}
