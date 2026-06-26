import { env } from '../env.ts';
import { logger } from '../logger.ts';

/**
 * Pluggable physical access-control integration (SRS FR-064). The VMS owns the credential
 * lifecycle; this adapter pushes activate/deactivate events to an external door-controller.
 *
 * Default: an HTTP webhook adapter that POSTs to ACCESS_CONTROL_WEBHOOK_URL when configured,
 * and is a no-op (debug log) otherwise. Calls are fire-and-forget so they never block check-in.
 */
export type CredentialEvent = {
  visitId: string;
  badgeNumber: string;
  zoneIds: string[];
  validFrom?: Date | null;
  validUntil?: Date | null;
};

export interface AccessControlAdapter {
  activate(event: CredentialEvent): Promise<void>;
  deactivate(event: Pick<CredentialEvent, 'visitId' | 'badgeNumber'>): Promise<void>;
}

async function post(action: 'activate' | 'deactivate', payload: Record<string, unknown>) {
  const url = env.ACCESS_CONTROL_WEBHOOK_URL;
  if (!url) {
    logger.debug({ action, payload }, 'access-control (no webhook configured)');
    return;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...payload, at: new Date().toISOString() }),
    });
    logger.debug({ action, status: res.status }, 'access-control webhook sent');
  } catch (err) {
    logger.error({ err, action }, 'access-control webhook failed');
  }
}

class WebhookAccessControl implements AccessControlAdapter {
  async activate(event: CredentialEvent): Promise<void> {
    await post('activate', { ...event });
  }
  async deactivate(event: Pick<CredentialEvent, 'visitId' | 'badgeNumber'>): Promise<void> {
    await post('deactivate', { ...event });
  }
}

export const accessControl: AccessControlAdapter = new WebhookAccessControl();
