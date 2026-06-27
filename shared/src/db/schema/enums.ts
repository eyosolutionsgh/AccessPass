import { pgEnum } from 'drizzle-orm/pg-core';

/** SRS FR-012 — appointment/visit lifecycle statuses. */
export const visitStatus = pgEnum('visit_status', [
  'draft',
  'pending_approval',
  'approved',
  'invitation_sent',
  'pre_registered',
  'checked_in',
  'checked_out',
  'cancelled',
  'expired',
  'denied',
  'no_show',
]);

/** SRS §7 — visit invitation (code + QR) token status. */
export const invitationStatus = pgEnum('invitation_status', [
  'active',
  'expired',
  'revoked',
  'used',
  'superseded',
]);

/** SRS §6.6 — temporary credential / badge status. */
export const credentialStatus = pgEnum('credential_status', [
  'issued',
  'active',
  'disabled',
  'expired',
  'revoked',
]);

/** SRS FR-060..064 — access permission status. */
export const accessPermissionStatus = pgEnum('access_permission_status', [
  'pending',
  'active',
  'disabled',
  'expired',
]);

/** SRS §6.5 / §6.9 — how a check-in or check-out was performed. */
export const checkEventMethod = pgEnum('check_event_method', [
  'qr',
  'code',
  'reception',
  'security',
  'host',
  'kiosk',
  'bulk',
]);

/** SRS §10.2 — notification delivery channels. `chat` = internal chat (Mattermost/Rocket.Chat). */
export const notificationChannel = pgEnum('notification_channel', [
  'email',
  'sms',
  'push',
  'webhook',
  'chat',
]);

/** SRS FR-074 — notification delivery status. */
export const notificationStatus = pgEnum('notification_status', [
  'queued',
  'sent',
  'delivered',
  'failed',
]);

/** SRS §9.1 — pre-registration completion state. */
export const preRegStatus = pgEnum('prereg_status', ['not_started', 'in_progress', 'completed']);

/** SRS §11.3 / §13 — security exception / incident classification. */
export const incidentType = pgEnum('incident_type', [
  'watchlist_match',
  'denied_entry',
  'duplicate_attempt',
  'expired_code',
  'invalid_code',
  'wrong_facility',
  'overstay',
  'policy_breach',
  'other',
]);

export const incidentSeverity = pgEnum('incident_severity', ['low', 'medium', 'high', 'critical']);

export const incidentStatus = pgEnum('incident_status', ['open', 'in_review', 'resolved']);

/** SRS §9.1 Document/Consent — type of stored document. */
export const documentType = pgEnum('document_type', [
  'nda',
  'privacy_notice',
  'site_rules',
  'safety_induction',
  'permit',
  'insurance',
  'work_authorization',
  'id_document',
  'photo',
  'other',
]);

/** SRS §11.3 — audited action result. */
export const auditResult = pgEnum('audit_result', ['success', 'failure', 'denied']);

/** SRS §11.3 — who performed an audited action: a logged-in user, the system, or an AI agent. */
export const auditActorKind = pgEnum('audit_actor_kind', ['human', 'system', 'ai']);

/** A visitor's checkpoint passage: entry check-in, exit check-out, or an internal checkpoint scan. */
export const checkpointEventKind = pgEnum('checkpoint_event_kind', [
  'check_in',
  'check_out',
  'passage',
]);

/** Reusable physical visitor tag: a printed number or an NFC card UID, issued + returned at the desk. */
export const tagKind = pgEnum('tag_kind', ['number', 'nfc']);

/**
 * A point is a fixed operating location a device is stationed at (e.g. a reception desk or a
 * security checkpoint). The kind categorises it for oversight; behaviour still comes from the
 * assigned device's profile.
 */
export const pointKind = pgEnum('point_kind', [
  'reception',
  'security',
  'checkpoint',
  'exit',
  'other',
]);
