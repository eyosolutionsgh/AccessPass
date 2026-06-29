import { and, eq } from 'drizzle-orm';
import {
  PREREG_IMAGE_ALLOWED_MIME,
  PREREG_IMAGE_MAX_BYTES,
  schema,
  type PreRegSubmitInput,
  type PreRegUploadInput,
} from '@vms/shared';
import { db } from '../db.ts';
import { hashToken } from '../lib/crypto.ts';
import { recordAudit } from '../lib/audit.ts';
import { emitVisitEvent } from '../realtime.ts';
import { getInstitutionContact, getOrganizationName, getPolicyContent } from './admin.ts';
import { decodeDataUrl, putObject } from './storage.ts';
import { randomUUID } from 'node:crypto';

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
  visitorEmail: string | null;
  visitorPhone: string | null;
  /** The institution the visitor is coming to (admin-set organisation name). */
  institutionName: string;
  hostName: string | null;
  hostDepartment: string | null;
  hostOffice: string | null;
  facilityName: string | null;
  facilityAddress: string | null;
  purpose: string | null;
  expectedArrival: Date | null;
  requiredFields: string[];
  policies: string[];
  /** Admin-maintained text for policies (e.g. site_rules, privacy_notice) the visitor can open. */
  policyContent: Record<string, string>;
  status: string;
  completed: boolean;
  /** Institution contact shown on the page so visitors can reach the organisation. */
  contact: { email: string | null; phone: string | null };
};

/** Resolve the pre-registration context from an invitation token (SRS FR-030/031). */
export async function getPreReg(token: string): Promise<PreRegContext | null> {
  const visit = await findVisitByToken(token);
  if (!visit || CLOSED.includes(visit.status)) return null;

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

  // The host's department/office give the visit its org context (mirrors getVisit, SRS FR-100).
  let hostDepartment: string | null = null;
  let hostOffice: string | null = null;
  if (host?.departmentId) {
    const [dep] = await db
      .select({ name: schema.department.name })
      .from(schema.department)
      .where(eq(schema.department.id, host.departmentId));
    hostDepartment = dep?.name ?? null;
  }
  if (host?.officeId) {
    const [off] = await db
      .select({ name: schema.office.name })
      .from(schema.office)
      .where(eq(schema.office.id, host.officeId));
    hostOffice = off?.name ?? null;
  }

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

  const contact = await getInstitutionContact();
  const policyContent = await getPolicyContent();
  const institutionName = await getOrganizationName();

  return {
    visitId: visit.id,
    visitorName: visitor?.fullName ?? 'Visitor',
    visitorEmail: visitor?.email ?? null,
    visitorPhone: visitor?.phone ?? null,
    institutionName,
    hostName: host?.name ?? null,
    hostDepartment,
    hostOffice,
    facilityName: facility?.name ?? null,
    facilityAddress: facility?.address ?? null,
    purpose: visit.purpose ?? null,
    expectedArrival: visit.expectedArrival,
    requiredFields,
    policies,
    policyContent,
    status: visit.status,
    completed: prereg?.status === 'completed',
    contact,
  };
}

/**
 * Store an optional identity image (selfie / ID) captured during pre-registration. Resolves the
 * visit by its invitation token (same CLOSED guard as the rest of the flow), validates + decodes
 * the data URL, uploads the bytes to object storage, and upserts a `document_record` — replacing
 * any prior image of the same kind for the visit so re-takes don't pile up.
 */
export async function uploadPreRegDocument(input: PreRegUploadInput) {
  const visit = await findVisitByToken(input.token);
  if (!visit || CLOSED.includes(visit.status))
    throw new Error('This pre-registration link is no longer valid');

  const { mime, bytes, ext } = decodeDataUrl(input.dataUrl, {
    allowedMime: PREREG_IMAGE_ALLOWED_MIME,
    maxBytes: PREREG_IMAGE_MAX_BYTES,
  });

  const docType = input.kind === 'selfie' ? 'photo' : 'id_document';
  const key = `prereg/${visit.id}/${input.kind}-${randomUUID()}.${ext}`;
  await putObject(key, bytes, mime);

  // One image per kind per visit: drop any earlier row (and its storage key reference) first.
  await db
    .delete(schema.documentRecord)
    .where(
      and(eq(schema.documentRecord.visitId, visit.id), eq(schema.documentRecord.type, docType)),
    );
  await db.insert(schema.documentRecord).values({
    visitId: visit.id,
    visitorId: visit.visitorId,
    type: docType,
    storageReference: key,
    status: 'active',
  });

  await recordAudit(db, {
    action: 'prereg.document',
    objectType: 'visit',
    objectId: visit.id,
    metadata: { kind: input.kind, bytes: bytes.length },
  });

  return { ok: true as const };
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
