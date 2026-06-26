import { env } from '../env.ts';
import { logger } from '../logger.ts';

type AuditEntryLike = {
  action: string;
  result?: string;
  actorId?: string | null;
  actorRole?: string | null;
  objectType?: string;
  objectId?: string;
  sourceIp?: string | null;
  metadata?: Record<string, unknown>;
};

const SECURITY_PREFIXES = ['watchlist', 'incident', 'checkin.watchlist', 'checkin.unknown'];

function isSecurityRelevant(entry: AuditEntryLike): boolean {
  if (entry.result === 'denied' || entry.result === 'failure') return true;
  if (entry.action === 'appointment.deny') return true;
  return SECURITY_PREFIXES.some((p) => entry.action.startsWith(p));
}

/**
 * Forward security-relevant audit events to a SIEM/security-logging endpoint (SRS §10.4).
 * Fire-and-forget; never throws into the caller. Disabled when SIEM_WEBHOOK_URL is unset.
 */
export function forwardAuditEvent(entry: AuditEntryLike): void {
  const url = env.SIEM_WEBHOOK_URL;
  if (!url || !isSecurityRelevant(entry)) return;
  void fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ source: 'vms', at: new Date().toISOString(), ...entry }),
  }).catch((err) => logger.error({ err, action: entry.action }, 'SIEM forward failed'));
}
