import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { schema, type CheckInLookup } from '@vms/shared';
import { db } from '../db.ts';
import { generateToken, hashCode, hashMatch, hashToken } from '../lib/crypto.ts';
import { recordAudit } from '../lib/audit.ts';
import { rateLimit } from '../lib/ratelimit.ts';
import { emitHostAlert, emitVisitEvent } from '../realtime.ts';
import { accessControl } from './accesscontrol.ts';
import { announceCheckpoint, recordCheckpointEvent } from './checkpoints.ts';
import { notifyContact } from './notifications/notify.ts';
import { raiseIncident } from './security.ts';

const badgeSuffix = customAlphabet('0123456789', 5);

/** SRS §7.4 validation outcomes. */
export type CheckInReason =
  | 'not_found'
  | 'expired'
  | 'revoked'
  | 'cancelled'
  | 'not_approved'
  | 'too_early'
  | 'too_late'
  | 'duplicate'
  | 'watchlist'
  | 'wrong_facility'
  | 'missing_prereg';

/** Visitor-facing messages — deliberately generic; never reveal whether a visit exists (QR-SEC-02). */
const MESSAGES: Record<CheckInReason, string> = {
  not_found: "We couldn't find a matching invitation. Please see reception.",
  expired: 'This invitation has expired. Please see reception.',
  revoked: 'This invitation is no longer valid. Please see reception.',
  cancelled: 'This visit has been cancelled. Please see reception.',
  not_approved: 'This visit is not yet approved. Please see reception.',
  too_early:
    'You are a little early — please check in closer to your appointment, or see reception.',
  too_late: 'Your arrival window has passed. Please see reception.',
  duplicate: 'This visit is already checked in. Please see reception.',
  watchlist: 'Please see reception to complete your check-in.',
  wrong_facility: 'This invitation is for a different location. Please see reception.',
  missing_prereg: 'Please complete pre-registration before checking in.',
};

export type VisitSummary = {
  visitId: string;
  visitorName: string;
  hostName: string | null;
  facilityName: string | null;
  status: string;
  expectedArrival: Date | null;
  needsPreReg: boolean;
};

export type LookupContext = { ip: string; facilityId?: string; deviceId?: string };
export type FailResult = { ok: false; reason: CheckInReason; message: string };
export type LookupResult = { ok: true; visit: VisitSummary } | FailResult;

const fail = (reason: CheckInReason): FailResult => ({
  ok: false,
  reason,
  message: MESSAGES[reason],
});

async function findInvitation(lookup: CheckInLookup) {
  const hash = lookup.kind === 'code' ? hashCode(lookup.code) : hashToken(lookup.token);
  const col =
    lookup.kind === 'code' ? schema.visitInvitation.codeHash : schema.visitInvitation.qrTokenHash;
  const [invitation] = await db
    .select()
    .from(schema.visitInvitation)
    .where(eq(col, hash))
    .orderBy(desc(schema.visitInvitation.issuedAt))
    .limit(1);
  return invitation ?? null;
}

/** Does this visit's category require pre-registration that isn't yet complete? (FR-045) */
async function needsPreRegistration(visit: typeof schema.visit.$inferSelect): Promise<boolean> {
  if (!visit.categoryId) return false;
  const [category] = await db
    .select()
    .from(schema.visitorCategory)
    .where(eq(schema.visitorCategory.id, visit.categoryId));
  const required =
    (category?.requiredFields.length ?? 0) > 0 || (category?.requiresInduction ?? false);
  if (!required) return false;
  const [prereg] = await db
    .select()
    .from(schema.preRegistration)
    .where(eq(schema.preRegistration.visitId, visit.id));
  return prereg?.status !== 'completed';
}

async function isWatchlisted(visitor: typeof schema.visitor.$inferSelect): Promise<boolean> {
  const candidates = [visitor.email, visitor.phone, visitor.fullName]
    .filter((v): v is string => Boolean(v))
    .map(hashMatch);
  if (candidates.length === 0) return false;
  const hits = await db
    .select({ id: schema.watchlistEntry.id })
    .from(schema.watchlistEntry)
    .where(
      and(
        eq(schema.watchlistEntry.isActive, true),
        inArray(schema.watchlistEntry.matchValueHash, candidates),
      ),
    );
  return hits.length > 0;
}

/** Track unknown/invalid attempts and alert security past a threshold (QR-SEC-01/§7.4). */
async function onUnknownAttempt(ctx: LookupContext, lookup: CheckInLookup): Promise<void> {
  const { count } = await rateLimit(`checkin:unknown:${ctx.ip}`, Number.MAX_SAFE_INTEGER, 300);
  await recordAudit(db, {
    action: 'checkin.unknown_attempt',
    result: 'failure',
    sourceIp: ctx.ip,
    deviceId: ctx.deviceId,
    metadata: { kind: lookup.kind },
  });
  if (count >= 5) {
    await raiseIncident({
      type: 'invalid_code',
      severity: 'medium',
      description: `${count} failed check-in attempts from ${ctx.ip}`,
      metadata: { ip: ctx.ip },
    });
  }
}

/**
 * Validate a presented code/QR against the SRS §7.4 outcome matrix. Pure read + side-effect
 * logging only — does NOT perform check-in.
 */
export async function validateLookup(
  lookup: CheckInLookup,
  ctx: LookupContext,
  opts: { readOnly?: boolean } = {},
): Promise<LookupResult> {
  const invitation = await findInvitation(lookup);
  if (!invitation) {
    if (!opts.readOnly) await onUnknownAttempt(ctx, lookup);
    return fail('not_found');
  }

  const [visit] = await db
    .select()
    .from(schema.visit)
    .where(eq(schema.visit.id, invitation.visitId));
  if (!visit) return fail('not_found');

  if (invitation.status === 'revoked' || invitation.status === 'superseded') return fail('revoked');

  if (visit.status === 'cancelled') return fail('cancelled');
  if (['draft', 'pending_approval', 'denied'].includes(visit.status)) return fail('not_approved');
  if (['checked_in', 'checked_out', 'no_show'].includes(visit.status)) return fail('duplicate');

  const now = Date.now();
  if (invitation.status === 'expired' || invitation.expiresAt.getTime() < now) {
    if (!opts.readOnly && invitation.status !== 'expired') {
      await db
        .update(schema.visitInvitation)
        .set({ status: 'expired' })
        .where(eq(schema.visitInvitation.id, invitation.id));
    }
    return fail('expired');
  }
  if (invitation.allowedFrom && now < invitation.allowedFrom.getTime()) return fail('too_early');
  if (invitation.allowedUntil && now > invitation.allowedUntil.getTime()) return fail('too_late');

  if (ctx.facilityId && visit.facilityId !== ctx.facilityId) return fail('wrong_facility');

  const [visitor] = await db
    .select()
    .from(schema.visitor)
    .where(eq(schema.visitor.id, visit.visitorId));
  if (visitor && (await isWatchlisted(visitor))) {
    if (!opts.readOnly) {
      await raiseIncident({
        visitId: visit.id,
        facilityId: visit.facilityId,
        type: 'watchlist_match',
        severity: 'high',
        description: 'Watchlist match at check-in',
        metadata: { ip: ctx.ip },
      });
      await recordAudit(db, {
        action: 'checkin.watchlist_match',
        result: 'denied',
        objectType: 'visit',
        objectId: visit.id,
        sourceIp: ctx.ip,
      });
    }
    return fail('watchlist'); // silent generic message to the visitor
  }

  const [host] = await db.select().from(schema.host).where(eq(schema.host.id, visit.hostId));
  const [facility] = await db
    .select()
    .from(schema.facility)
    .where(eq(schema.facility.id, visit.facilityId));

  return {
    ok: true,
    visit: {
      visitId: visit.id,
      visitorName: visitor?.fullName ?? 'Visitor',
      hostName: host?.name ?? null,
      facilityName: facility?.name ?? null,
      status: visit.status,
      expectedArrival: visit.expectedArrival,
      needsPreReg: await needsPreRegistration(visit),
    },
  };
}

/**
 * Read-only eligibility probe — same outcome as validateLookup but performs NO writes (no expiry
 * flip, no unknown-attempt logging, no watchlist incident/audit). Safe for AI/MCP or concierge
 * "is this code valid?" checks that must not mutate state (audit finding P4). Still returns the
 * generic MESSAGES, never the raw reason, so a visitor-facing surface cannot leak the outcome.
 */
export function validateLookupReadOnly(
  lookup: CheckInLookup,
  ctx: LookupContext,
): Promise<LookupResult> {
  return validateLookup(lookup, ctx, { readOnly: true });
}

export type CheckInActor = { id: string; role?: string | null } | null;
export type CompleteResult =
  | {
      ok: true;
      visitId: string;
      badgeNumber: string;
      badgeToken: string;
      visitorName: string;
      hostName: string | null;
      checkInTime: Date;
    }
  | FailResult;

/**
 * Complete a check-in (SRS §6.5 / §7.3 steps 9-11): record the event, issue a badge/credential,
 * activate time-bound access, set status, and notify the host.
 */
export async function completeCheckIn(
  lookup: CheckInLookup,
  ctx: LookupContext,
  actor: CheckInActor = null,
): Promise<CompleteResult> {
  const result = await validateLookup(lookup, ctx);
  if (!result.ok) return result;
  if (result.visit.needsPreReg) return fail('missing_prereg');

  const visitId = result.visit.visitId;
  const invitation = await findInvitation(lookup);
  if (!invitation) return fail('not_found');

  const checkInTime = new Date();
  const badgeNumber = `V-${badgeSuffix()}`;
  const badgeToken = generateToken(16);

  // Perform the whole state mutation atomically under a row lock on the visit, so concurrent kiosk
  // + reception check-ins of the same code serialize: the first commits 'checked_in', the second
  // re-reads it under the lock and bails as a duplicate (closes the check-in race; SRS §7.3).
  const tx = await db.transaction(async (trx) => {
    const [visit] = await trx
      .select()
      .from(schema.visit)
      .where(eq(schema.visit.id, visitId))
      .for('update');
    if (!visit) return { ok: false as const, reason: 'not_found' as CheckInReason };
    // Re-check under the lock — another transaction may have completed check-in in the meantime.
    if (['checked_in', 'checked_out', 'no_show'].includes(visit.status)) {
      return { ok: false as const, reason: 'duplicate' as CheckInReason };
    }

    await trx
      .update(schema.visitInvitation)
      .set({ status: 'used' })
      .where(eq(schema.visitInvitation.id, invitation.id));

    await trx.insert(schema.checkInRecord).values({
      visitId,
      timeIn: checkInTime,
      checkInMethod: actor ? 'reception' : lookup.kind,
      checkInLocation: result.visit.facilityName,
      deviceId: ctx.deviceId,
      processedBy: actor?.id,
      selfService: !actor,
      identityVerified: Boolean(actor),
    });

    const badgeExpiry = invitation.allowedUntil ?? visit.expectedDeparture ?? null;
    await trx.insert(schema.credential).values({
      visitId,
      badgeNumber,
      qrBadgeTokenHash: hashToken(badgeToken),
      status: 'active',
      expiresAt: badgeExpiry,
    });

    // Time-bound zone access (SRS FR-060/061).
    if (visit.requestedZoneIds.length > 0) {
      await trx.insert(schema.accessPermission).values(
        visit.requestedZoneIds.map((zoneId) => ({
          visitId,
          zoneId,
          startTime: checkInTime,
          endTime: badgeExpiry,
          status: 'active' as const,
        })),
      );
    }

    await trx
      .update(schema.visit)
      .set({ status: 'checked_in' })
      .where(eq(schema.visit.id, visitId));

    return {
      ok: true as const,
      badgeExpiry,
      zoneIds: visit.requestedZoneIds,
      hostId: visit.hostId,
      facilityId: visit.facilityId,
    };
  });

  if (!tx.ok) return fail(tx.reason);

  // External side-effects run AFTER commit — never hold a DB transaction open across a network
  // call, and these are best-effort (must not roll back a successful check-in).
  await accessControl.activate({
    visitId,
    badgeNumber,
    zoneIds: tx.zoneIds,
    validFrom: checkInTime,
    validUntil: tx.badgeExpiry,
  });

  await notifyHostOfArrival(tx.hostId, result.visit.visitorName, visitId, tx.facilityId);

  await recordAudit(db, {
    actorId: actor?.id,
    actorRole: actor?.role,
    action: 'checkin.complete',
    objectType: 'visit',
    objectId: visitId,
    sourceIp: ctx.ip,
    deviceId: ctx.deviceId,
    metadata: { method: actor ? 'reception' : lookup.kind, badgeNumber },
  });

  // First entry on the visitor's checkpoint trail.
  await recordCheckpointEvent(db, {
    visitId,
    deviceId: ctx.deviceId,
    kind: 'check_in',
    method: actor ? 'reception' : lookup.kind,
  });
  await announceCheckpoint(visitId);

  return {
    ok: true,
    visitId,
    badgeNumber,
    badgeToken,
    visitorName: result.visit.visitorName,
    hostName: result.visit.hostName,
    checkInTime,
  };
}

async function notifyHostOfArrival(
  hostId: string,
  visitorName: string,
  visitId: string,
  facilityId: string,
): Promise<void> {
  const [host] = await db.select().from(schema.host).where(eq(schema.host.id, hostId));
  const at = new Date().toISOString();
  emitHostAlert(hostId, { type: 'checked_in', visitId, visitorName, at, facilityId });
  emitVisitEvent({
    type: 'checked_in',
    visitId,
    visitorName,
    facilityId,
    at,
    hostName: host?.name,
  });

  // Notify the host — email and/or local SMS (never blocks check-in; notifyContact never throws).
  await notifyContact({
    visitId,
    template: 'host_arrival',
    email: host?.email
      ? {
          address: host.email,
          subject: `${visitorName} has arrived`,
          html: `<p>Your visitor <strong>${visitorName}</strong> has checked in and is waiting at reception.</p>`,
          text: `Your visitor ${visitorName} has checked in and is waiting at reception.`,
        }
      : undefined,
    sms: host?.phone
      ? { phone: host.phone, text: `${visitorName} has arrived at reception.` }
      : undefined,
  });
}

/** Record departure: disable credentials + access, set status, update the on-site list (SRS §6.9). */
export async function checkOut(visitId: string, ctx: LookupContext, actor: CheckInActor = null) {
  const [visit] = await db.select().from(schema.visit).where(eq(schema.visit.id, visitId));
  if (!visit) throw new Error('Visit not found');
  if (visit.status !== 'checked_in') throw new Error('Visit is not currently checked in');

  const now = new Date();
  const [credential] = await db
    .select({ badgeNumber: schema.credential.badgeNumber })
    .from(schema.credential)
    .where(and(eq(schema.credential.visitId, visitId), eq(schema.credential.status, 'active')));

  await db
    .update(schema.checkInRecord)
    .set({ timeOut: now, checkOutMethod: actor ? 'reception' : 'kiosk', processedBy: actor?.id })
    .where(and(eq(schema.checkInRecord.visitId, visitId), isNull(schema.checkInRecord.timeOut)));

  await db
    .update(schema.credential)
    .set({ status: 'disabled', disabledAt: now })
    .where(and(eq(schema.credential.visitId, visitId), eq(schema.credential.status, 'active')));

  await db
    .update(schema.accessPermission)
    .set({ status: 'disabled' })
    .where(
      and(
        eq(schema.accessPermission.visitId, visitId),
        eq(schema.accessPermission.status, 'active'),
      ),
    );

  await db.update(schema.visit).set({ status: 'checked_out' }).where(eq(schema.visit.id, visitId));

  // Revoke the temporary credential from the access-control system (SRS FR-062).
  await accessControl.deactivate({ visitId, badgeNumber: credential?.badgeNumber ?? '' });

  emitVisitEvent({
    type: 'checked_out',
    visitId,
    facilityId: visit.facilityId,
    at: now.toISOString(),
  });
  await recordAudit(db, {
    actorId: actor?.id,
    actorRole: actor?.role,
    action: 'checkin.checkout',
    objectType: 'visit',
    objectId: visitId,
    sourceIp: ctx.ip,
    deviceId: ctx.deviceId,
  });

  // Exit on the visitor's checkpoint trail.
  await recordCheckpointEvent(db, {
    visitId,
    deviceId: ctx.deviceId,
    kind: 'check_out',
    method: actor ? 'reception' : 'kiosk',
  });
  await announceCheckpoint(visitId);

  return { visitId, status: 'checked_out' as const };
}

export type GuardScanResult =
  | {
      ok: true;
      visitId: string;
      visitorName: string;
      organization: string | null;
      hostName: string | null;
      departmentName: string | null;
      officeName: string | null;
      purpose: string | null;
      expectedArrival: Date | null;
      expectedDeparture: Date | null;
      checkpoint: string | null;
      watchlisted: boolean;
    }
  | { ok: false; message: string };

/**
 * Guard-operated checkpoint scan (staff-authenticated, unlike the public kiosk `passageScan`):
 * looks up a checked-in visitor's QR/code and returns full identity + visit details for the
 * guard to verify on the spot, flags a watchlist match, and logs the passage attributed to the
 * scanning guard (SRS §3.2 security_guard/security_manager checkpoint duty).
 */
export async function guardScan(
  lookup: CheckInLookup,
  ctx: { deviceId?: string; ip: string; guardId: string },
): Promise<GuardScanResult> {
  const invitation = await findInvitation(lookup);
  if (!invitation) return { ok: false, message: 'No matching visit found.' };

  const [visit] = await db
    .select()
    .from(schema.visit)
    .where(eq(schema.visit.id, invitation.visitId));
  if (!visit || visit.status !== 'checked_in') {
    return { ok: false, message: 'This visitor is not currently checked in.' };
  }

  const [row] = await db
    .select({
      visitor: schema.visitor,
      hostName: schema.host.name,
      departmentName: schema.department.name,
      officeName: schema.office.name,
    })
    .from(schema.visit)
    .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
    .leftJoin(schema.host, eq(schema.host.id, schema.visit.hostId))
    .leftJoin(schema.department, eq(schema.department.id, schema.host.departmentId))
    .leftJoin(schema.office, eq(schema.office.id, schema.host.officeId))
    .where(eq(schema.visit.id, visit.id));

  const watchlisted = row?.visitor ? await isWatchlisted(row.visitor) : false;

  await recordCheckpointEvent(db, {
    visitId: visit.id,
    deviceId: ctx.deviceId,
    kind: 'passage',
    method: lookup.kind,
    verifiedBy: ctx.guardId,
  });
  await announceCheckpoint(visit.id);

  let checkpoint: string | null = null;
  if (ctx.deviceId) {
    const [d] = await db
      .select({ label: schema.deviceProfile.label })
      .from(schema.deviceProfile)
      .where(eq(schema.deviceProfile.deviceId, ctx.deviceId))
      .limit(1);
    checkpoint = d?.label ?? null;
  }

  if (watchlisted) {
    await raiseIncident({
      visitId: visit.id,
      facilityId: visit.facilityId,
      type: 'watchlist_match',
      severity: 'high',
      description: 'Watchlist match at checkpoint scan',
      metadata: { guardId: ctx.guardId, deviceId: ctx.deviceId },
      actor: { id: ctx.guardId },
    });
  }

  await recordAudit(db, {
    actorId: ctx.guardId,
    action: 'checkpoint.guard_scan',
    objectType: 'visit',
    objectId: visit.id,
    sourceIp: ctx.ip,
    deviceId: ctx.deviceId,
    metadata: { watchlisted },
  });

  return {
    ok: true,
    visitId: visit.id,
    visitorName: row?.visitor?.fullName ?? 'Visitor',
    organization: row?.visitor?.organization ?? null,
    hostName: row?.hostName ?? null,
    departmentName: row?.departmentName ?? null,
    officeName: row?.officeName ?? null,
    purpose: visit.purpose,
    expectedArrival: visit.expectedArrival,
    expectedDeparture: visit.expectedDeparture,
    checkpoint,
    watchlisted,
  };
}
