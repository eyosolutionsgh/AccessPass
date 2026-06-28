import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import {
  schema,
  type CreateVisitInput,
  type ListVisitsInput,
  type UpdateVisitInput,
} from '@vms/shared';
import { db } from '../db.ts';
import { recordAudit } from '../lib/audit.ts';
import { getOrganizationName } from './admin.ts';
import { getEmailLogo } from './email/brandLogo.ts';
import { institutionLabel } from './email/mailer.ts';
import { currentCheckpoint, currentLocations } from './checkpoints.ts';
import { issueInvitation, revokeInvitation } from './invitations.ts';
import { notifyContact } from './notifications/notify.ts';
import { findConflicts, SchedulingConflictError } from './conflicts.ts';
import { assertSecretaryScope } from './scope.ts';

type Actor = { id: string; role?: string | null };

/** Statuses in which an appointment may still be edited (before arrival) — SRS FR-014. */
const EDITABLE = new Set(['draft', 'pending_approval', 'approved', 'invitation_sent']);

async function resolveVisitorId(input: CreateVisitInput): Promise<string> {
  if (input.visitorId) return input.visitorId;
  if (!input.visitor) throw new Error('Visitor details required');
  const [created] = await db
    .insert(schema.visitor)
    .values({
      fullName: input.visitor.fullName,
      organization: input.visitor.organization,
      email: input.visitor.email,
      phone: input.visitor.phone,
    })
    .returning();
  if (!created) throw new Error('Failed to create visitor');
  return created.id;
}

/**
 * Create an appointment (SRS §5.1). Categories flagged `requiresApproval` route to
 * Pending Approval; otherwise the visit is approved and an invitation is issued immediately.
 */
export async function createVisit(input: CreateVisitInput, actor: Actor) {
  // Secretaries may only book for officers in their own office (no-op for other roles).
  await assertSecretaryScope(actor, input.hostId);

  // The visit inherits the officer's office (for room clash detection) and facility.
  const [hostRow] = await db
    .select({ officeId: schema.host.officeId, facilityId: schema.host.facilityId })
    .from(schema.host)
    .where(eq(schema.host.id, input.hostId));
  const officeId = hostRow?.officeId ?? null;
  const facilityId = input.facilityId ?? hostRow?.facilityId ?? null;
  if (!facilityId) {
    throw new Error(
      'Selected officer has no facility assigned. Set their facility in admin first.',
    );
  }

  const visitorId = await resolveVisitorId(input);

  // Block double-booking the officer, the room, or the visitor.
  if (input.expectedArrival && input.expectedDeparture) {
    const conflicts = await findConflicts({
      hostId: input.hostId,
      officeId,
      visitorId,
      start: input.expectedArrival,
      end: input.expectedDeparture,
    });
    if (conflicts.length) throw new SchedulingConflictError(conflicts);
  }

  let requiresApproval = false;
  if (input.categoryId) {
    const [category] = await db
      .select()
      .from(schema.visitorCategory)
      .where(eq(schema.visitorCategory.id, input.categoryId));
    requiresApproval = category?.requiresApproval ?? false;
  }

  const [visit] = await db
    .insert(schema.visit)
    .values({
      visitorId,
      hostId: input.hostId,
      facilityId,
      officeId,
      categoryId: input.categoryId,
      purpose: input.purpose,
      expectedArrival: input.expectedArrival,
      expectedDeparture: input.expectedDeparture,
      requestedZoneIds: input.requestedZoneIds,
      status: requiresApproval ? 'pending_approval' : 'approved',
      createdBy: actor.id,
    })
    .returning();
  if (!visit) throw new Error('Failed to create visit');

  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'appointment.create',
    objectType: 'visit',
    objectId: visit.id,
    metadata: { status: visit.status, requiresApproval },
  });

  // No approval needed → issue the invitation now.
  if (!requiresApproval) {
    const invitation = await issueInvitation(visit.id, actor);
    return { visitId: visit.id, status: 'invitation_sent' as const, invitation };
  }
  return { visitId: visit.id, status: visit.status, invitation: null };
}

function assertValidForApproval(visit: typeof schema.visit.$inferSelect) {
  // SRS FR-016 — block approval of invalid/expired appointments.
  if (visit.expectedDeparture && visit.expectedDeparture.getTime() < Date.now()) {
    throw new Error('Cannot approve a visit whose time window has already passed');
  }
}

export async function approveVisit(visitId: string, actor: Actor) {
  const [visit] = await db.select().from(schema.visit).where(eq(schema.visit.id, visitId));
  if (!visit) throw new Error('Visit not found');
  if (visit.status !== 'pending_approval') {
    throw new Error(`Visit is ${visit.status}, not pending approval`);
  }
  assertValidForApproval(visit);

  // Two pending visits can both pass creation; the one approved first wins the slot.
  if (visit.expectedArrival && visit.expectedDeparture) {
    const conflicts = await findConflicts({
      hostId: visit.hostId,
      officeId: visit.officeId,
      visitorId: visit.visitorId,
      start: visit.expectedArrival,
      end: visit.expectedDeparture,
      excludeVisitId: visit.id,
    });
    if (conflicts.length) throw new SchedulingConflictError(conflicts);
  }

  await db
    .update(schema.visit)
    .set({ status: 'approved', approvedBy: actor.id, approvedAt: new Date() })
    .where(eq(schema.visit.id, visitId));

  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'appointment.approve',
    objectType: 'visit',
    objectId: visitId,
  });

  const invitation = await issueInvitation(visitId, actor);
  return { visitId, status: 'invitation_sent' as const, invitation };
}

export async function denyVisit(visitId: string, reason: string, actor: Actor) {
  const [updated] = await db
    .update(schema.visit)
    .set({ status: 'denied', denialReason: reason })
    .where(eq(schema.visit.id, visitId))
    .returning();
  if (!updated) throw new Error('Visit not found');

  await revokeActiveInvitations(visitId, actor);
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'appointment.deny',
    objectType: 'visit',
    objectId: visitId,
    metadata: { reason },
  });

  // Notify the visitor with a neutral, reason-free decline (SRS FR-074) — email and/or local SMS.
  // The internal `reason` is intentionally NOT disclosed. Never blocks denial (never throws).
  const [visitor] = await db
    .select({
      fullName: schema.visitor.fullName,
      email: schema.visitor.email,
      phone: schema.visitor.phone,
    })
    .from(schema.visitor)
    .where(eq(schema.visitor.id, updated.visitorId));
  const organizationName = await getOrganizationName();
  const logo = await getEmailLogo();
  await notifyContact({
    visitId,
    template: 'visit_declined',
    email: visitor?.email
      ? {
          address: visitor.email,
          subject: 'Update on your visit request',
          html: `<div style="text-align:center;margin-bottom:16px;"><img src="cid:${logo.cid}" width="96" height="80" alt="${organizationName} logo" style="display:inline-block;border:0;" /><div style="margin-top:8px;font-weight:bold;color:#0f172a;">${institutionLabel(organizationName)}</div></div><p>Dear ${visitor.fullName},</p><p>Unfortunately your scheduled visit could not be confirmed at this time. Please contact your host for further details.</p><p>${institutionLabel(organizationName)}</p>`,
          text: `Dear ${visitor.fullName},\n\nUnfortunately your scheduled visit could not be confirmed at this time. Please contact your host for further details.\n\n${institutionLabel(organizationName)}`,
          attachments: [{ filename: logo.filename, content: logo.content, cid: logo.cid }],
        }
      : undefined,
    sms: visitor?.phone
      ? {
          phone: visitor.phone,
          text: 'Your visit request could not be confirmed at this time. Please contact your host.',
        }
      : undefined,
  });

  return { visitId, status: 'denied' as const };
}

export async function cancelVisit(visitId: string, actor: Actor) {
  const [visit] = await db.select().from(schema.visit).where(eq(schema.visit.id, visitId));
  if (!visit) throw new Error('Visit not found');
  if (visit.status === 'checked_in' || visit.status === 'checked_out') {
    throw new Error('Cannot cancel a visit that has already checked in');
  }
  await db.update(schema.visit).set({ status: 'cancelled' }).where(eq(schema.visit.id, visitId));
  await revokeActiveInvitations(visitId, actor);
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'appointment.cancel',
    objectType: 'visit',
    objectId: visitId,
  });
  return { visitId, status: 'cancelled' as const };
}

export async function updateVisit(input: UpdateVisitInput, actor: Actor) {
  const [visit] = await db.select().from(schema.visit).where(eq(schema.visit.id, input.visitId));
  if (!visit) throw new Error('Visit not found');
  if (!EDITABLE.has(visit.status)) {
    throw new Error(`Cannot edit a visit in status ${visit.status}`);
  }
  // Secretaries may only reschedule appointments for officers in their own office.
  await assertSecretaryScope(actor, visit.hostId);

  // Re-check clashes against the effective (possibly rescheduled) window, ignoring this visit.
  const start = input.expectedArrival ?? visit.expectedArrival;
  const end = input.expectedDeparture ?? visit.expectedDeparture;
  if (start && end) {
    if (end.getTime() <= start.getTime()) {
      throw new Error('Expected departure must be after expected arrival');
    }
    const conflicts = await findConflicts({
      hostId: visit.hostId,
      officeId: visit.officeId,
      visitorId: visit.visitorId,
      start,
      end,
      excludeVisitId: visit.id,
    });
    if (conflicts.length) throw new SchedulingConflictError(conflicts);
  }

  const [updated] = await db
    .update(schema.visit)
    .set({
      purpose: input.purpose ?? visit.purpose,
      expectedArrival: input.expectedArrival ?? visit.expectedArrival,
      expectedDeparture: input.expectedDeparture ?? visit.expectedDeparture,
      categoryId: input.categoryId === undefined ? visit.categoryId : input.categoryId,
      requestedZoneIds: input.requestedZoneIds ?? visit.requestedZoneIds,
    })
    .where(eq(schema.visit.id, input.visitId))
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'appointment.update',
    objectType: 'visit',
    objectId: input.visitId,
  });
  return updated;
}

async function revokeActiveInvitations(visitId: string, actor: Actor) {
  const active = await db
    .select({ id: schema.visitInvitation.id })
    .from(schema.visitInvitation)
    .where(
      and(eq(schema.visitInvitation.visitId, visitId), eq(schema.visitInvitation.status, 'active')),
    );
  for (const inv of active) await revokeInvitation(inv.id, actor);
}

export async function listVisits(input: ListVisitsInput) {
  const conditions = [];
  if (input.facilityId) conditions.push(eq(schema.visit.facilityId, input.facilityId));
  if (input.hostId) conditions.push(eq(schema.visit.hostId, input.hostId));
  if (input.status) conditions.push(eq(schema.visit.status, input.status));
  if (input.from) conditions.push(gte(schema.visit.expectedArrival, input.from));
  if (input.to) conditions.push(lte(schema.visit.expectedArrival, input.to));
  if (input.search) {
    const q = `%${input.search}%`;
    conditions.push(
      or(
        ilike(schema.visitor.fullName, q),
        ilike(schema.visitor.organization, q),
        ilike(schema.host.name, q),
      ),
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: schema.visit.id,
      status: schema.visit.status,
      purpose: schema.visit.purpose,
      expectedArrival: schema.visit.expectedArrival,
      visitorName: schema.visitor.fullName,
      visitorOrg: schema.visitor.organization,
      hostName: schema.host.name,
      departmentName: schema.department.name,
      officeName: schema.office.name,
      facilityName: schema.facility.name,
    })
    .from(schema.visit)
    .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
    .leftJoin(schema.host, eq(schema.host.id, schema.visit.hostId))
    .leftJoin(schema.department, eq(schema.department.id, schema.host.departmentId))
    .leftJoin(schema.office, eq(schema.office.id, schema.host.officeId))
    .leftJoin(schema.facility, eq(schema.facility.id, schema.visit.facilityId))
    .where(where)
    .orderBy(desc(schema.visit.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.visit)
    .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
    .leftJoin(schema.host, eq(schema.host.id, schema.visit.hostId))
    .where(where);

  // Annotate on-site visitors with their current checkpoint so the host sees where they are.
  const onSite = rows.filter((r) => r.status === 'checked_in').map((r) => r.id);
  const locations = await currentLocations(onSite);
  const items = rows.map((r) => ({
    ...r,
    location: locations.get(r.id)?.checkpoint ?? null,
  }));

  return { items, total: count, page: input.page, pageSize: input.pageSize };
}

export async function getVisit(visitId: string) {
  const [visit] = await db.select().from(schema.visit).where(eq(schema.visit.id, visitId));
  if (!visit) throw new Error('Visit not found');
  const [visitor] = await db
    .select()
    .from(schema.visitor)
    .where(eq(schema.visitor.id, visit.visitorId));
  const [host] = await db.select().from(schema.host).where(eq(schema.host.id, visit.hostId));
  // The host's department/office give the visit its org context (SRS FR-100).
  let hostDepartment: string | null = null;
  let hostOffice: string | null = null;
  if (host?.departmentId) {
    const [d] = await db
      .select({ name: schema.department.name })
      .from(schema.department)
      .where(eq(schema.department.id, host.departmentId));
    hostDepartment = d?.name ?? null;
  }
  if (host?.officeId) {
    const [o] = await db
      .select({ name: schema.office.name })
      .from(schema.office)
      .where(eq(schema.office.id, host.officeId));
    hostOffice = o?.name ?? null;
  }
  const [facility] = await db
    .select()
    .from(schema.facility)
    .where(eq(schema.facility.id, visit.facilityId));
  const [invitation] = await db
    .select({
      id: schema.visitInvitation.id,
      status: schema.visitInvitation.status,
      expiresAt: schema.visitInvitation.expiresAt,
      issuedAt: schema.visitInvitation.issuedAt,
    })
    .from(schema.visitInvitation)
    .where(eq(schema.visitInvitation.visitId, visitId))
    .orderBy(desc(schema.visitInvitation.issuedAt))
    .limit(1);

  // Where the visitor currently is (their latest checkpoint) — lets the host track them live.
  const location = await currentCheckpoint(visitId);

  return {
    visit,
    visitor,
    host: host ? { ...host, departmentName: hostDepartment, officeName: hostOffice } : host,
    facility,
    invitation: invitation ?? null,
    location: location
      ? { checkpoint: location.checkpoint, kind: location.kind, at: location.at }
      : null,
  };
}
