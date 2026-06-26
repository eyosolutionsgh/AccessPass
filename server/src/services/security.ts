import { and, desc, eq, gte, sql } from 'drizzle-orm';
import {
  schema,
  type IncidentCreateInput,
  type IncidentListInput,
  type WatchlistAddInput,
} from '@vms/shared';
import { db } from '../db.ts';
import { env } from '../env.ts';
import { logger } from '../logger.ts';
import { hashMatch } from '../lib/crypto.ts';
import { recordAudit } from '../lib/audit.ts';
import { emitVisitEvent, emitSecurityAlert } from '../realtime.ts';
import { isEmbeddingEnabled } from './ai/client.ts';
import { dispatch, isChannelAvailable } from './notifications/dispatcher.ts';

/**
 * Fire-and-forget: queue an incident for embedding so similar-incident search has data. Never
 * blocks or throws into incident creation. The maintenance worker runs the actual embed; the
 * enqueue is imported dynamically so services/tests don't pull in the BullMQ/Redis connection.
 */
async function scheduleIncidentEmbedding(incidentId: string | undefined): Promise<void> {
  if (!incidentId || !isEmbeddingEnabled()) return;
  try {
    const { enqueueIncidentEmbed } = await import('../jobs/maintenance.ts');
    await enqueueIncidentEmbed(incidentId);
  } catch (err) {
    logger.warn({ err, incidentId }, 'failed to enqueue incident embedding');
  }
}

type Actor = { id: string; role?: string | null };
type IncidentType = (typeof schema.incidentType.enumValues)[number];
type IncidentSeverity = (typeof schema.incidentSeverity.enumValues)[number];

// ── Watchlist (SRS FR-072) ──────────────────────────────────────────────────

/** Add a watchlist entry. Stores only the HMAC of the (normalised) value — never raw PII. */
export async function addWatchlistEntry(input: WatchlistAddInput, actor: Actor) {
  const [entry] = await db
    .insert(schema.watchlistEntry)
    .values({
      matchType: input.matchType,
      matchValueHash: hashMatch(input.value),
      reason: input.reason,
      createdBy: actor.id,
    })
    .returning({ id: schema.watchlistEntry.id });
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'watchlist.add',
    objectType: 'watchlist_entry',
    objectId: entry?.id,
    metadata: { matchType: input.matchType },
  });
  return entry;
}

export function listWatchlist() {
  return db
    .select({
      id: schema.watchlistEntry.id,
      matchType: schema.watchlistEntry.matchType,
      reason: schema.watchlistEntry.reason,
      isActive: schema.watchlistEntry.isActive,
      createdAt: schema.watchlistEntry.createdAt,
    })
    .from(schema.watchlistEntry)
    .where(eq(schema.watchlistEntry.isActive, true))
    .orderBy(desc(schema.watchlistEntry.createdAt));
}

export async function removeWatchlistEntry(id: string, actor: Actor) {
  await db
    .update(schema.watchlistEntry)
    .set({ isActive: false })
    .where(eq(schema.watchlistEntry.id, id));
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'watchlist.remove',
    objectType: 'watchlist_entry',
    objectId: id,
  });
}

// ── Incidents (SRS FR-091/093) ──────────────────────────────────────────────

export async function listIncidents(input: IncidentListInput) {
  const conditions = [];
  if (input.type) conditions.push(eq(schema.incident.type, input.type));
  if (input.severity) conditions.push(eq(schema.incident.severity, input.severity));
  if (input.status) conditions.push(eq(schema.incident.status, input.status));
  const where = conditions.length ? and(...conditions) : undefined;

  const items = await db
    .select({
      id: schema.incident.id,
      type: schema.incident.type,
      severity: schema.incident.severity,
      status: schema.incident.status,
      description: schema.incident.description,
      visitId: schema.incident.visitId,
      visitorName: schema.visitor.fullName,
      createdAt: schema.incident.createdAt,
    })
    .from(schema.incident)
    .leftJoin(schema.visit, eq(schema.visit.id, schema.incident.visitId))
    .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
    .where(where)
    .orderBy(desc(schema.incident.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.incident)
    .where(where);

  return { items, total: count, page: input.page, pageSize: input.pageSize };
}

export type RaiseIncidentInput = {
  type: IncidentType;
  severity?: IncidentSeverity;
  description?: string;
  visitId?: string | null;
  /** Facility id, used only for the realtime exception event (dashboards). */
  facilityId?: string | null;
  metadata?: Record<string, unknown>;
  /** Set when a human raised it (manual); omitted for system auto-detections. */
  actor?: Actor;
};

/**
 * Single entry point for raising a security incident (SRS FR-091/093): persist the row (with
 * metadata), emit the realtime 'exception' event for the security/reception dashboards, and fan
 * out to the internal security chat channel when configured (best-effort; dispatch never throws).
 * Used by system detections (watchlist, invalid code, overstay) and manual creation alike.
 */
export async function raiseIncident(
  input: RaiseIncidentInput,
): Promise<{ id: string } | undefined> {
  const severity = input.severity ?? 'low';
  const [incident] = await db
    .insert(schema.incident)
    .values({
      visitId: input.visitId ?? null,
      type: input.type,
      severity,
      description: input.description,
      metadata: input.metadata,
    })
    .returning({ id: schema.incident.id });

  // Audit EVERY incident here (system + manual) so the SIEM and AI analyst see all of them — this
  // is the single chokepoint that fixes incidents previously bypassing the audit log.
  await recordAudit(db, {
    actorId: input.actor?.id ?? null,
    actorRole: input.actor?.role ?? null,
    actorKind: input.actor ? 'human' : 'system',
    action: 'incident.raised',
    objectType: 'incident',
    objectId: incident?.id,
    metadata: { type: input.type, severity, visitId: input.visitId ?? null },
  });

  const event = {
    type: 'exception' as const,
    visitId: input.visitId ?? '-',
    facilityId: input.facilityId ?? undefined,
    at: new Date().toISOString(),
  };
  emitVisitEvent(event); // refresh reception/security dashboards
  emitSecurityAlert(event); // dedicated security room (incident + AI alerts)

  if (isChannelAvailable('chat')) {
    const text = `🚨 Security incident — ${input.type} (${severity})${input.description ? `: ${input.description}` : ''}`;
    await dispatch({
      visitId: input.visitId ?? null,
      recipient: env.SECURITY_CHAT_CHANNEL ?? '',
      channel: 'chat',
      template: `incident_${input.type}`,
      message: { subject: `Security: ${input.type}`, text },
    });
  }

  // Queue embedding for similar-incident search (best-effort; non-blocking).
  void scheduleIncidentEmbedding(incident?.id);
  return incident;
}

export async function createIncident(input: IncidentCreateInput, actor: Actor) {
  // raiseIncident now records the audit entry (with the actor) — single audit chokepoint.
  return raiseIncident({
    visitId: input.visitId,
    type: input.type,
    severity: input.severity,
    description: input.description,
    actor,
  });
}

export async function resolveIncident(
  incidentId: string,
  resolution: string | undefined,
  actor: Actor,
) {
  await db
    .update(schema.incident)
    .set({ status: 'resolved', resolvedBy: actor.id, resolvedAt: new Date() })
    .where(eq(schema.incident.id, incidentId));
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'incident.resolve',
    objectType: 'incident',
    objectId: incidentId,
    metadata: { resolution },
  });
}

// ── Emergency muster + security summary (SRS §5.4, FR-091) ───────────────────

/** Full on-site list with contact details for emergency mustering (security only). */
export function musterList(facilityId?: string) {
  const conditions = [eq(schema.visit.status, 'checked_in')];
  if (facilityId) conditions.push(eq(schema.visit.facilityId, facilityId));
  return db
    .select({
      visitId: schema.visit.id,
      visitorName: schema.visitor.fullName,
      organization: schema.visitor.organization,
      phone: schema.visitor.phone,
      hostName: schema.host.name,
      facilityName: schema.facility.name,
      badgeNumber: schema.credential.badgeNumber,
      timeIn: schema.checkInRecord.timeIn,
    })
    .from(schema.visit)
    .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
    .leftJoin(schema.host, eq(schema.host.id, schema.visit.hostId))
    .leftJoin(schema.facility, eq(schema.facility.id, schema.visit.facilityId))
    .leftJoin(
      schema.credential,
      and(eq(schema.credential.visitId, schema.visit.id), eq(schema.credential.status, 'active')),
    )
    .leftJoin(
      schema.checkInRecord,
      and(
        eq(schema.checkInRecord.visitId, schema.visit.id),
        sql`${schema.checkInRecord.timeOut} is null`,
      ),
    )
    .where(and(...conditions))
    .orderBy(schema.visitor.fullName);
}

export async function securitySummary() {
  const since = new Date(Date.now() - 24 * 3_600_000);

  const [{ onSite } = { onSite: 0 }] = await db
    .select({ onSite: sql<number>`count(*)::int` })
    .from(schema.visit)
    .where(eq(schema.visit.status, 'checked_in'));

  const [{ openIncidents } = { openIncidents: 0 }] = await db
    .select({ openIncidents: sql<number>`count(*)::int` })
    .from(schema.incident)
    .where(eq(schema.incident.status, 'open'));

  const [{ overstays } = { overstays: 0 }] = await db
    .select({ overstays: sql<number>`count(*)::int` })
    .from(schema.incident)
    .where(and(eq(schema.incident.type, 'overstay'), eq(schema.incident.status, 'open')));

  const [{ deniedToday } = { deniedToday: 0 }] = await db
    .select({ deniedToday: sql<number>`count(*)::int` })
    .from(schema.visit)
    .where(and(eq(schema.visit.status, 'denied'), gte(schema.visit.updatedAt, since)));

  return { onSite, openIncidents, overstays, deniedToday };
}
