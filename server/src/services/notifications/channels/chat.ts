/**
 * Internal chat channel adapter (SRS §10.2). Targets a Mattermost incoming webhook by default;
 * the payload is Slack-compatible, so the same adapter works for Rocket.Chat and on-prem Teams by
 * pointing CHAT_WEBHOOK_URL elsewhere. Mattermost/Rocket.Chat are self-hostable on-prem, which
 * keeps notifications inside the air-gap (no SaaS Slack/Teams cloud).
 *
 * `recipient` selects the target channel/handle (e.g. `#security-alerts`); it falls back to
 * CHAT_DEFAULT_CHANNEL, or the webhook's own default channel when neither is set. POST returns a
 * small `ok` body on success; a non-2xx response throws to drive the dispatcher's retry path.
 *
 * Disabled (returns null → not registered) unless CHAT_WEBHOOK_URL is set.
 */
import { env } from '../../../env.ts';
import type { ChannelAdapter, RenderedMessage } from '../dispatcher.ts';

function buildChatChannel(): ChannelAdapter | null {
  const url = env.CHAT_WEBHOOK_URL;
  if (!url) return null;

  return {
    channel: 'chat',
    async send(recipient: string, message: RenderedMessage) {
      const channel = recipient || env.CHAT_DEFAULT_CHANNEL;
      const text = message.subject ? `**${message.subject}**\n${message.text}` : message.text;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, username: env.CHAT_USERNAME, ...(channel ? { channel } : {}) }),
      });
      if (!res.ok) {
        const body = (await res.text()).trim();
        throw new Error(`chat webhook failed (http ${res.status}): ${body.slice(0, 200)}`);
      }
      return {};
    },
  };
}

export const chatChannel: ChannelAdapter | null = buildChatChannel();
