import { eq } from 'drizzle-orm';
import { schema, type PreRegSubmitInput } from '@vms/shared';
import { db } from '../db.ts';
import { hashToken } from '../lib/crypto.ts';
import { recordAudit } from '../lib/audit.ts';
import { emitVisitEvent } from '../realtime.ts';

const CLOSED = ['cancelled', 'denied', 'checked_in', 'checked_out', 'no_show', 'expired'];

async function findVisitByToken(token: string) {
  const [invitation] = await db
    .select()
    .from(schema.visitInvitation)
    .where(eq(schema.visitInvitation.qrTokenHash, hashToken(token)))
    .limit(1);
  if (!invitation) return null;
  const [visit] = await db
    .select()
    .from(schema.visit)
    .where(eq(schema.visit.id, invitation.visitId));
  return visit ?? null;
}

export type PreRegContext = {
  visitId: string;
  visitorName: string;
  hostName: string | null;
  facilityName: string | null;
  facilityAddress: string | null;
  expectedArrival: Date | null;
  requiredFields: string[];
  policies: string[];
  status: string;
  completed: boolean;
};

/** Resolve the pre-registration context from an invitation token (SRS FR-030/031). */
export async function getPreReg(token: string): Promise<PreRegContext | null> {
  const visit = await findVisitByToken(token);
  if (!visit || CLOSED.includes(visit.status)) return null;

  const [visitor] = await db
    .select()
    .from(schema.visitor)
    .where(eq(schema.visitor.id, visit.visitorId));
  const [host] = await db.select().from(schema.host).where(eq(schema.host.id, visit.hostId));
  const [facility] = await db
    .select()
    .from(schema.facility)
    .where(eq(schema.facility.id, visit.facilityId));

  let requiredFields: string[] = [];
  const policies = ['privacy_notice', 'site_rules'];
  if (visit.categoryId) {
    const [category] = await db
      .select()
      .from(schema.visitorCategory)
      .where(eq(schema.visitorCategory.id, visit.categoryId));
    requiredFields = category?.requiredFields ?? [];
    if (category?.requiresInduction) policies.push('safety_induction', 'nda');
  }

  const [prereg] = await db
    .select()
    .from(schema.preRegistration)
    .where(eq(schema.preRegistration.visitId, visit.id));

  return {
    visitId: visit.id,
    visitorName: visitor?.fullName ?? 'Visitor',
    hostName: host?.name ?? null,
    facilityName: facility?.name ?? null,
    facilityAddress: facility?.address ?? null,
    expectedArrival: visit.expectedArrival,
    requiredFields,
    policies,
    status: visit.status,
    completed: prereg?.status === 'completed',
  };
}

/** Submit pre-registration: persist field/consent state and mark the visit Pre-Registered (FR-035). */
export async function submitPreReg(input: PreRegSubmitInput) {
  const visit = await findVisitByToken(input.token);
  if (!visit || CLOSED.includes(visit.status))
    throw new Error('This pre-registration link is no longer valid');

  const requiredFieldsStatus = Object.fromEntries(
    Object.entries(input.fields).map(([k, v]) => [k, Boolean(v)]),
  );

  const [existing] = await db
    .select()
    .from(schema.preRegistration)
    .where(eq(schema.preRegistration.visitId, visit.id));

  const values = {
    status: 'completed' as const,
    submittedAt: new Date(),
    requiredFieldsStatus,
    policyAckStatus: input.acknowledgements,
    consentGiven: new Date().toISOString(),
  };

  if (existing) {
    await db
      .update(schema.preRegistration)
      .set(values)
      .where(eq(schema.preRegistration.id, existing.id));
  } else {
    await db.insert(schema.preRegistration).values({ visitId: visit.id, ...values });
  }

  // Optionally enrich visitor contact details supplied during pre-registration.
  if (input.visitorEmail || input.visitorPhone) {
    await db
      .update(schema.visitor)
      .set({
        email: input.visitorEmail || undefined,
        phone: input.visitorPhone || undefined,
      })
      .where(eq(schema.visitor.id, visit.visitorId));
  }

  if (['approved', 'invitation_sent'].includes(visit.status)) {
    await db
      .update(schema.visit)
      .set({ status: 'pre_registered' })
      .where(eq(schema.visit.id, visit.id));
  }

  emitVisitEvent({
    type: 'pre_registered',
    visitId: visit.id,
    facilityId: visit.facilityId,
    at: new Date().toISOString(),
  });
  await recordAudit(db, {
    action: 'prereg.submit',
    objectType: 'visit',
    objectId: visit.id,
  });

  return { ok: true as const, visitId: visit.id };
}
