/**
 * SMS channel adapter (SRS §10.2). Provider: Nalo Solutions — the gateway standardised across
 * projects (see kito-ride `server/security/betterAuth.ts:smsShim`).
 *
 * Contract: GET NALO_SMS_ENDPOINT with URL params (so the `@` in the password and spaces in the
 * body are encoded). Success is signalled by a response body that starts with `1701,<message-id>`;
 * any other code is a failure. Throwing on failure drives the dispatcher's retry path.
 *
 * Disabled (returns null → not registered) unless SMS_PROVIDER=nalo with username + password.
 * NOTE: SMS requires outbound reach to the Nalo endpoint (or an on-prem Nalo-compatible gateway
 * via NALO_SMS_ENDPOINT) — an explicit, opt-in egress, off by default in an air-gapped install.
 */
import { env } from '../../../env.ts';
import { logger } from '../../../logger.ts';
import type { ChannelAdapter, RenderedMessage } from '../dispatcher.ts';

/** Nalo's `destination` wants a bare MSISDN (e.g. 233244123456), not E.164's leading `+`. */
function toMsisdn(recipient: string): string {
  const cleaned = recipient.replace(/[\s-]/g, '');
  return cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
}

function buildNaloChannel(): ChannelAdapter | null {
  if (env.SMS_PROVIDER !== 'nalo') return null;
  const username = env.NALO_SMS_USERNAME;
  const password = env.NALO_SMS_PASSWORD;
  if (!username || !password) {
    logger.warn(
      'SMS_PROVIDER=nalo but NALO_SMS_USERNAME/NALO_SMS_PASSWORD are missing — SMS channel disabled',
    );
    return null;
  }

  return {
    channel: 'sms',
    async send(recipient: string, message: RenderedMessage) {
      const params = new URLSearchParams({
        username,
        password,
        type: '0',
        destination: toMsisdn(recipient),
        dlr: '1',
        source: env.NALO_SMS_SOURCE,
        message: message.text,
      });
      const res = await fetch(`${env.NALO_SMS_ENDPOINT}?${params.toString()}`, { method: 'GET' });
      const body = (await res.text()).trim();
      // Nalo success format: `1701,<message-id>`.
      if (res.ok && body.startsWith('1701')) {
        return { providerMessageId: body.split(',')[1] ?? undefined };
      }
      throw new Error(`nalo sms failed (http ${res.status}): ${body.slice(0, 200)}`);
    },
  };
}

export const smsChannel: ChannelAdapter | null = buildNaloChannel();
