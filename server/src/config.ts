/**
 * Default invitation/check-in policy (SRS FR-103). These are sensible defaults; in a later
 * phase they become per-facility / per-category admin settings persisted in the database.
 */
export const invitationPolicy = {
  /** Invitation code length within the SRS 6–10 range (QR-003). */
  codeLength: 6,
  /** How early before the appointment a visitor may check in (SRS §7.4). */
  earlyArrivalMinutes: 60,
  /** Grace period after the appointment before the invitation is rejected. */
  lateArrivalMinutes: 120,
  /** Fallback validity when no appointment time is set. */
  defaultValidityHours: 24,
};

/** Display name used in invitation emails when a facility has no better label. */
export const ORGANIZATION_NAME = 'Access Pass';
