import { and, eq, inArray } from 'drizzle-orm';
import { schema } from '@vms/shared';
import { invitationPolicy } from '../config.ts';
import { db } from '../db.ts';
import { generateInvitationCode, generateToken, hashCode, hashToken } from '../lib/crypto.ts';
import { qrPng } from '../lib/qr.ts';
import { recordAudit } from '../lib/audit.ts';
import { formatDateTime } from '../lib/datetime.ts';
import { env } from '../env.ts';
import { getDateDisplay, getInstitutionContact, getOrganizationName } from './admin.ts';
import { institutionLabel } from './email/mailer.ts';
import { notifyContact, type ContactNotification } from './notifications/notify.ts';
import { renderInvitationEmail } from './email/templates/invitation.ts';
import { getEmailLogo } from './email/brandLogo.ts';

type Actor = { id: string; role?: string | null };

export type IssuedInvitation = {
  invitationId: string;
  visitId: string;
  /** Raw values returned ONLY to the issuing staff/API caller — never persisted in clear. */
  code: string;
  checkInUrl: string;
  expiresAt: Date;
};

/** Load the visit with the related rows needed to build an invitation/email. */
async function loadVisitContext(visitId: string) {
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

function computeWindow(expectedArrival: Date | null, expectedDeparture: Date | null) {
  const now = new Date();
  const arrival = expectedArrival ?? now;
  const allowedFrom = new Date(arrival.getTime() - invitationPolicy.earlyArrivalMinutes * 60_000);
  const baseEnd = expectedDeparture ?? arrival;
  const allowedUntil = new Date(baseEnd.getTime() + invitationPolicy.lateArrivalMinutes * 60_000);
  const expiresAt = expectedArrival
    ? allowedUntil
    : new Date(now.getTime() + invitationPolicy.defaultValidityHours * 3_600_000);
  return { allowedFrom, allowedUntil, expiresAt };
}

/** Mark any active invitations for a visit as superseded (SRS QR-007). */
async function supersedeActive(visitId: string): Promise<void> {
  await db
    .update(schema.visitInvitation)
    .set({ status: 'superseded' })
    .where(
      and(
        eq(schema.visitInvitation.visitId, visitId),
        inArray(schema.visitInvitation.status, ['active']),
      ),
    );
}

/**
 * Generate a code + QR token for a visit, email the visitor, and record everything.
 * Stores only hashes (SRS QR-SEC-05). Returns the raw code/URL to the caller.
 */
export async function issueInvitation(visitId: string, actor?: Actor): Promise<IssuedInvitation> {
  const { visit, visitor, host, facility } = await loadVisitContext(visitId);

  await supersedeActive(visitId);

  const code = generateInvitationCode(invitationPolicy.codeLength);
  const token = generateToken();
  const { allowedFrom, allowedUntil, expiresAt } = computeWindow(
    visit.expectedArrival,
    visit.expectedDeparture,
  );

  const [invitation] = await db
    .insert(schema.visitInvitation)
    .values({
      visitId,
      codeHash: hashCode(code),
      qrTokenHash: hashToken(token),
      status: 'active',
      expiresAt,
      allowedFrom,
      allowedUntil,
    })
    .returning();
  if (!invitation) throw new Error('Failed to create invitation');

  // QR/links open the web (kiosk) UI, which validates the token via tRPC.
  const checkInUrl = `${env.WEB_ORIGIN}/check-in?t=${token}`;
  const preRegisterUrl = `${env.WEB_ORIGIN}/pre-register?t=${token}`;

  // Notify the visitor — email (with QR) when we have an address, SMS when the number is local
  // (SRS FR-024/074). Notification failure must NOT block issuance (NFR-AVL-02); notifyContact
  // delegates to dispatch(), which never throws.
  const display = await getDateDisplay();
  const organizationName = await getOrganizationName();
  const contact = await getInstitutionContact();
  const visitDateStr = visit.expectedArrival
    ? formatDateTime(visit.expectedArrival, {
        dateFormat: display.dateFormat,
        timeZone: facility?.timezone || display.timeZone,
      })
    : 'your scheduled date';

  let emailPart: ContactNotification['email'];
  if (visitor?.email) {
    const qr = await qrPng(checkInUrl);
    const logo = await getEmailLogo();
    const { subject, html, text } = renderInvitationEmail({
      organizationName,
      brandLabel: institutionLabel(organizationName),
      logoCid: logo.cid,
      visitorName: visitor.fullName,
      hostName: host?.name ?? 'your host',
      facilityName: facility?.name ?? 'the facility',
      facilityAddress: facility?.address,
      visitDate: visitDateStr,
      invitationCode: code,
      checkInUrl,
      preRegisterUrl,
      qrCid: 'vms-qr',
      contactEmail: contact.email,
      contactPhone: contact.phone,
    });
    emailPart = {
      address: visitor.email,
      subject,
      html,
      text,
      attachments: [
        { filename: 'check-in-qr.png', content: qr, cid: 'vms-qr' },
        { filename: logo.filename, content: logo.content, cid: logo.cid },
      ],
    };
  }

  await notifyContact({
    visitId,
    template: 'invitation',
    email: emailPart,
    sms: visitor?.phone
      ? {
          phone: visitor.phone,
          text:
            `${organizationName}: your visit is confirmed for ${visitDateStr}. Check-in code: ${code}. ${checkInUrl}` +
            (contact.email || contact.phone
              ? ` Questions? ${[contact.email, contact.phone].filter(Boolean).join(' · ')}`
              : ''),
        }
      : undefined,
  });

  await db
    .update(schema.visit)
    .set({ status: 'invitation_sent' })
    .where(eq(schema.visit.id, visitId));

  await recordAudit(db, {
    actorId: actor?.id,
    actorRole: actor?.role,
    action: 'invitation.issue',
    objectType: 'visit_invitation',
    objectId: invitation.id,
    metadata: { visitId, codePrefix: code.slice(0, 2) + '****', emailed: Boolean(visitor?.email) },
  });

  return { invitationId: invitation.id, visitId, code, checkInUrl, expiresAt };
}

export async function resendInvitation(visitId: string, actor?: Actor): Promise<IssuedInvitation> {
  // Re-issuing supersedes the previous token (SRS QR-007) and re-emails.
  const result = await issueInvitation(visitId, actor);
  await db
    .update(schema.visitInvitation)
    .set({ resendCount: 1 })
    .where(eq(schema.visitInvitation.id, result.invitationId));
  await recordAudit(db, {
    actorId: actor?.id,
    actorRole: actor?.role,
    action: 'invitation.resend',
    objectType: 'visit_invitation',
    objectId: result.invitationId,
    metadata: { visitId },
  });
  return result;
}

export async function revokeInvitation(invitationId: string, actor?: Actor): Promise<void> {
  const [updated] = await db
    .update(schema.visitInvitation)
    .set({ status: 'revoked', revokedAt: new Date() })
    .where(eq(schema.visitInvitation.id, invitationId))
    .returning();
  if (!updated) throw new Error('Invitation not found');
  await recordAudit(db, {
    actorId: actor?.id,
    actorRole: actor?.role,
    action: 'invitation.revoke',
    objectType: 'visit_invitation',
    objectId: invitationId,
    metadata: { visitId: updated.visitId },
  });
}
