import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { schema, type CheckoutLookup } from '@vms/shared';
import { db } from '../db.ts';
import { generateToken, hashCode, hashToken } from '../lib/crypto.ts';
import { recordAudit } from '../lib/audit.ts';
import { logger } from '../logger.ts';
import { raiseIncident } from './security.ts';
import { checkOut, type LookupContext } from './checkin.ts';

type Actor = { id: string; role?: string | null };

export type BadgePrintData = {
  visitId: string;
  visitorName: string;
  organization: string | null;
  hostName: string | null;
  facilityName: string | null;
  badgeNumber: string;
  /** Raw badge token for the printed QR (returned only to staff/kiosk). */
  badgeToken: string;
};

async function badgeContext(visitId: string) {
  const [visit] = await db.select().from(schema.visit).where(eq(schema.visit.id, visitId));
  if (!visit) throw new Error('Visit not found');
  const [visitor] = await db
    .select()
    .from(schema.visitor)
    .where(eq(schema.visitor.id, visit.visitorId));
  const [host] = visit.hostId
    ? await db.select().from(schema.host).where(eq(schema.host.id, visit.hostId))
    : [];
  const [facility] = await db
    .select()
    .from(schema.facility)
    .where(eq(schema.facility.id, visit.facilityId));
  return { visit, visitor, host, facility };
}

/**
 * Reprint a visitor badge (SRS FR-054). Issues a fresh badge QR token (the old printed badge's
 * QR is superseded) but keeps the badge number; logs the reason in the audit trail.
 */
export async function reprintBadge(
  visitId: string,
  reason: string,
  actor: Actor,
): Promise<BadgePrintData> {
  const [credential] = await db
    .select()
    .from(schema.credential)
    .where(and(eq(schema.credential.visitId, visitId), eq(schema.credential.status, 'active')));
  if (!credential) throw new Error('No active badge to reprint');

  const badgeToken = generateToken(16);
  await db
    .update(schema.credential)
    .set({ qrBadgeTokenHash: hashToken(badgeToken) })
    .where(eq(schema.credential.id, credential.id));

  const { visitor, host, facility } = await badgeContext(visitId);

  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'badge.reprint',
    objectType: 'credential',
    objectId: credential.id,
    metadata: { visitId, badgeNumber: credential.badgeNumber, reason },
  });

  return {
    visitId,
    visitorName: visitor?.fullName ?? 'Visitor',
    organization: visitor?.organization ?? null,
    hostName: host?.name ?? null,
    facilityName: facility?.name ?? null,
    badgeNumber: credential.badgeNumber,
    badgeToken,
  };
}

/** Resolve a visit from a check-out lookup (invitation code or scanned badge QR). */
async function resolveCheckoutVisit(lookup: CheckoutLookup): Promise<string | null> {
  if (lookup.kind === 'code') {
    const [invitation] = await db
      .select({ visitId: schema.visitInvitation.visitId })
      .from(schema.visitInvitation)
      .where(eq(schema.visitInvitation.codeHash, hashCode(lookup.code)))
      .limit(1);
    return invitation?.visitId ?? null;
  }
  if (lookup.kind === 'qr') {
    const [invitation] = await db
      .select({ visitId: schema.visitInvitation.visitId })
      .from(schema.visitInvitation)
      .where(eq(schema.visitInvitation.qrTokenHash, hashToken(lookup.token)))
      .limit(1);
    return invitation?.visitId ?? null;
  }
  const [credential] = await db
    .select({ visitId: schema.credential.visitId })
    .from(schema.credential)
    .where(eq(schema.credential.qrBadgeTokenHash, hashToken(lookup.token)))
    .limit(1);
  return credential?.visitId ?? null;
}

export type SelfCheckoutResult = { ok: true; visitId: string } | { ok: false; message: string };

/** Check-out by invitation code or badge QR, attributed to the staff member at post. */
export async function checkOutSelf(
  lookup: CheckoutLookup,
  ctx: LookupContext,
  actor: Actor | null = null,
): Promise<SelfCheckoutResult> {
  const visitId = await resolveCheckoutVisit(lookup);
  if (!visitId)
    return { ok: false, message: 'We could not find a matching check-in. Please see reception.' };
  const [visit] = await db.select().from(schema.visit).where(eq(schema.visit.id, visitId));
  if (!visit || visit.status !== 'checked_in') {
    return { ok: false, message: 'This visit is not currently checked in. Please see reception.' };
  }
  await checkOut(visitId, ctx, actor);
  return { ok: true, visitId };
}

export type SweepResult = { expiredCredentials: number; expiredAccess: number; overstays: number };

/**
 * Periodic lifecycle sweep (run by the maintenance worker):
 *  - expire credentials past their validity (SRS FR-053)
 *  - expire access permissions past their window (FR-062)
 *  - raise overstay incidents for visitors still on-site past expected departure (FR-083)
 */
export async function runExpirySweep(): Promise<SweepResult> {
  const now = new Date();

  const expiredCreds = await db
    .update(schema.credential)
    .set({ status: 'expired' })
    .where(
      and(
        eq(schema.credential.status, 'active'),
        isNotNull(schema.credential.expiresAt),
        lt(schema.credential.expiresAt, now),
      ),
    )
    .returning({ id: schema.credential.id });

  const expiredAccess = await db
    .update(schema.accessPermission)
    .set({ status: 'expired' })
    .where(
      and(
        eq(schema.accessPermission.status, 'active'),
        isNotNull(schema.accessPermission.endTime),
        lt(schema.accessPermission.endTime, now),
      ),
    )
    .returning({ id: schema.accessPermission.id });

  // Overstays: still checked in past expected departure, without an existing open incident.
  const overstayVisits = await db
    .select({ id: schema.visit.id, facilityId: schema.visit.facilityId })
    .from(schema.visit)
    .where(
      and(
        eq(schema.visit.status, 'checked_in'),
        isNotNull(schema.visit.expectedDeparture),
        lt(schema.visit.expectedDeparture, now),
      ),
    );

  let overstays = 0;
  for (const v of overstayVisits) {
    const [existing] = await db
      .select({ id: schema.incident.id })
      .from(schema.incident)
      .where(
        and(
          eq(schema.incident.visitId, v.id),
          eq(schema.incident.type, 'overstay'),
          eq(schema.incident.status, 'open'),
        ),
      );
    if (existing) continue;
    await raiseIncident({
      visitId: v.id,
      facilityId: v.facilityId,
      type: 'overstay',
      severity: 'low',
      description: 'Visitor remains on-site past expected departure',
    });
    overstays++;
  }

  const result = {
    expiredCredentials: expiredCreds.length,
    expiredAccess: expiredAccess.length,
    overstays,
  };
  if (result.expiredCredentials || result.expiredAccess || result.overstays) {
    logger.info(result, 'credential/overstay sweep');
  }
  return result;
}
