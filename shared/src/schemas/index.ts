/**
 * Shared Zod schemas + domain constants — the single source of validation truth reused by
 * tRPC procedures, the REST gateway, and client forms.
 */
import { z } from 'zod';
import { ROLE_VALUES } from '../rbac/permissions.ts';

/**
 * Invitation-code alphabet — uppercase alphanumerics excluding confusable characters
 * O/0 and I/1 (SRS QR-003). Used by the server's nanoid generator and by validation.
 */
export const INVITATION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITATION_CODE_MIN = 6;
export const INVITATION_CODE_MAX = 10;

/** Normalise a manually-entered code: trim, strip spaces/hyphens, uppercase (SRS Appendix A). */
export function normalizeInvitationCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

export const invitationCodeSchema = z
  .string()
  .transform(normalizeInvitationCode)
  .pipe(
    z
      .string()
      .min(INVITATION_CODE_MIN)
      .max(INVITATION_CODE_MAX)
      .regex(new RegExp(`^[${INVITATION_CODE_ALPHABET}]+$`), 'Code contains invalid characters'),
  );

/** Either path into the on-facility check-in flow (SRS §7.3). */
export const checkInLookupSchema = z.union([
  z.object({ kind: z.literal('code'), code: invitationCodeSchema }),
  z.object({ kind: z.literal('qr'), token: z.string().min(16) }),
]);
export type CheckInLookup = z.infer<typeof checkInLookupSchema>;

/** Public check-in request: a lookup plus optional kiosk context (SRS §7.3). */
export const checkInSubmitSchema = z.object({
  lookup: checkInLookupSchema,
  facilityId: z.uuid().optional(),
  deviceId: z.string().max(120).optional(),
});
export type CheckInSubmitInput = z.infer<typeof checkInSubmitSchema>;

/** Self-service check-out: by invitation code or by scanning the badge QR (SRS FR-080). */
export const checkoutLookupSchema = z.union([
  z.object({ kind: z.literal('code'), code: invitationCodeSchema }),
  z.object({ kind: z.literal('badge'), token: z.string().min(16) }),
  // Re-scan the invitation QR to check out (resolved by its QR-token hash).
  z.object({ kind: z.literal('qr'), token: z.string().min(8) }),
]);
export type CheckoutLookup = z.infer<typeof checkoutLookupSchema>;

/** Badge reprint with mandatory reason (SRS FR-054). */
export const reprintSchema = z.object({ visitId: z.uuid(), reason: z.string().min(1).max(200) });

/** Pre-registration token (carried by the invitation link, SRS FR-030). */
export const tokenSchema = z.object({ token: z.string().min(16) });

/** Pre-registration submission (SRS FR-032/033). */
export const preRegSubmitSchema = z.object({
  token: z.string().min(16),
  fields: z.record(z.string(), z.string()).default({}),
  acknowledgements: z.record(z.string(), z.boolean()).default({}),
  visitorEmail: z.union([z.literal(''), z.email()]).optional(),
  visitorPhone: z.string().max(40).optional(),
});
export type PreRegSubmitInput = z.infer<typeof preRegSubmitSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type Pagination = z.infer<typeof paginationSchema>;

/** SRS FR-012 — visit lifecycle statuses (mirrors the Drizzle `visit_status` enum). */
export const VISIT_STATUSES = [
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
] as const;
export const visitStatusSchema = z.enum(VISIT_STATUSES);
export type VisitStatusValue = (typeof VISIT_STATUSES)[number];

/**
 * Statuses in which a visit still "occupies" its officer/room/visitor slot and therefore
 * counts toward clash detection (SRS FR-013). Excludes terminal/freeing states
 * (checked_out, cancelled, expired, denied, no_show).
 */
export const OCCUPYING_VISIT_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'invitation_sent',
  'pre_registered',
  'checked_in',
] as const satisfies readonly VisitStatusValue[];

/** SRS FR-011 — appointment-creation input. Either reference an existing visitor or inline one. */
export const createVisitSchema = z
  .object({
    visitorId: z.uuid().optional(),
    visitor: z
      .object({
        fullName: z.string().min(1),
        organization: z.string().optional(),
        email: z.email().optional(),
        phone: z.string().optional(),
      })
      .optional(),
    hostId: z.uuid(),
    // Optional: when omitted the server derives the facility from the selected officer (host).
    facilityId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    purpose: z.string().max(500).optional(),
    // Required: a scheduled appointment must have a time window so it can be checked for clashes.
    expectedArrival: z.coerce.date(),
    expectedDeparture: z.coerce.date(),
    requestedZoneIds: z.array(z.uuid()).default([]),
  })
  .refine((v) => v.visitorId || v.visitor, {
    message: 'Provide either visitorId or visitor details',
    path: ['visitor'],
  })
  .refine((v) => v.expectedDeparture > v.expectedArrival, {
    message: 'Expected departure must be after expected arrival',
    path: ['expectedDeparture'],
  })
  // A visitor must be reachable so their invitation/QR can be delivered (SRS §7.2) — require at
  // least one of email or phone when registering a new (inline) visitor.
  .refine((v) => !v.visitor || Boolean(v.visitor.email || v.visitor.phone), {
    message: 'Provide a phone number or email for the visitor',
    path: ['visitor', 'email'],
  });
export type CreateVisitInput = z.infer<typeof createVisitSchema>;

/** SRS FR-014 — update an appointment before check-in. */
export const updateVisitSchema = z.object({
  visitId: z.uuid(),
  purpose: z.string().max(500).optional(),
  expectedArrival: z.coerce.date().optional(),
  expectedDeparture: z.coerce.date().optional(),
  categoryId: z.uuid().nullish(),
  requestedZoneIds: z.array(z.uuid()).optional(),
});
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;

/** SRS FR-090 — reception/host dashboard filters. */
export const listVisitsSchema = z.object({
  facilityId: z.uuid().optional(),
  hostId: z.uuid().optional(),
  status: visitStatusSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListVisitsInput = z.infer<typeof listVisitsSchema>;

export const visitIdSchema = z.object({ visitId: z.uuid() });
export const denyVisitSchema = z.object({ visitId: z.uuid(), reason: z.string().max(500) });
export const invitationIdSchema = z.object({ invitationId: z.uuid() });

// ── Security & audit (SRS §11.3, §12, FR-072/091/093) ───────────────────────
export const INCIDENT_TYPES = [
  'watchlist_match',
  'denied_entry',
  'duplicate_attempt',
  'expired_code',
  'invalid_code',
  'wrong_facility',
  'overstay',
  'policy_breach',
  'other',
] as const;
export const incidentTypeSchema = z.enum(INCIDENT_TYPES);

export const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const incidentSeveritySchema = z.enum(INCIDENT_SEVERITIES);

export const INCIDENT_STATUSES = ['open', 'in_review', 'resolved'] as const;
export const incidentStatusSchema = z.enum(INCIDENT_STATUSES);

/** SRS FR-072 — add a watchlist entry; the server hashes the value, never storing raw PII. */
export const WATCHLIST_MATCH_TYPES = ['name', 'email', 'phone', 'id'] as const;
export const watchlistAddSchema = z.object({
  matchType: z.enum(WATCHLIST_MATCH_TYPES),
  value: z.string().min(2).max(200),
  reason: z.string().max(300).optional(),
});
export type WatchlistAddInput = z.infer<typeof watchlistAddSchema>;
export const idSchema = z.object({ id: z.uuid() });

export const incidentListSchema = z.object({
  type: incidentTypeSchema.optional(),
  severity: incidentSeveritySchema.optional(),
  status: incidentStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type IncidentListInput = z.infer<typeof incidentListSchema>;

export const incidentResolveSchema = z.object({
  incidentId: z.uuid(),
  resolution: z.string().max(500).optional(),
});

/** SRS FR-093 — record an incident/note against a visit. */
export const incidentCreateSchema = z.object({
  visitId: z.uuid().optional(),
  type: incidentTypeSchema,
  severity: incidentSeveritySchema.default('low'),
  description: z.string().min(1).max(1000),
});
export type IncidentCreateInput = z.infer<typeof incidentCreateSchema>;

/** SRS §11.3 — filterable audit log query. */
export const auditListSchema = z.object({
  actorId: z.string().optional(),
  action: z.string().max(120).optional(),
  objectType: z.string().max(60).optional(),
  result: z.enum(['success', 'failure', 'denied']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditListInput = z.infer<typeof auditListSchema>;

// ── Admin configuration (SRS §6.11) ─────────────────────────────────────────
export const roleSchema = z.enum(ROLE_VALUES);

export const facilityCreateSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(40),
  address: z.string().max(300).optional(),
  timezone: z.string().max(60).default('UTC'),
});
export const facilityUpdateSchema = facilityCreateSchema.partial().extend({
  id: z.uuid(),
  isActive: z.boolean().optional(),
});

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(80),
  code: z.string().min(1).max(40),
  requiresApproval: z.boolean().default(false),
  requiresEscort: z.boolean().default(false),
  requiresInduction: z.boolean().default(false),
  requiredFields: z.array(z.string().max(60)).default([]),
});
export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  id: z.uuid(),
  isActive: z.boolean().optional(),
});

// ── Departments / divisions & offices / rooms (SRS FR-100) ───────────────────
export const departmentCreateSchema = z.object({
  name: z.string().min(1).max(120),
  facilityId: z.uuid().optional(),
});
export const departmentUpdateSchema = departmentCreateSchema.partial().extend({ id: z.uuid() });

export const officeCreateSchema = z.object({
  name: z.string().min(1).max(120),
  departmentId: z.uuid(),
});
export const officeUpdateSchema = officeCreateSchema.partial().extend({ id: z.uuid() });

/**
 * Soft-delete / restore toggle shared by every admin configuration model (facility, visitor
 * category, department, office, checkpoint). Deactivating sets `isActive = false` instead of a
 * destructive delete, so historical references (visits, hosts, trails) stay intact.
 */
export const adminSetActiveSchema = z.object({ id: z.uuid(), isActive: z.boolean() });
export type AdminSetActiveInput = z.infer<typeof adminSetActiveSchema>;

/** Supported default date-display formats (admin-configurable; SRS NFR-MNT-01). */
export const dateFormatSchema = z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'D MMM YYYY']);
export type DateFormat = z.infer<typeof dateFormatSchema>;

/**
 * Named AI read-aloud (TTS) voices — OpenAI-compatible names served by the on-prem Piper voice
 * server (openedai-speech). Accent is implied by the voice: `fable` is UK English, the rest US.
 */
export const voiceNameSchema = z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']);
export type VoiceName = z.infer<typeof voiceNameSchema>;

/** Human labels for the voices (character + accent), used in the admin settings UI. */
export const VOICE_LABELS: Record<VoiceName, string> = {
  alloy: 'Alloy — US English',
  echo: 'Echo — US English (male)',
  fable: 'Fable — UK English (male)',
  onyx: 'Onyx — US English (male)',
  nova: 'Nova — US English (female)',
  shimmer: 'Shimmer — US English (female)',
};

/**
 * Read-aloud language. `en` uses the named English voices (Piper); `ak` (Twi/Akan) uses the
 * separate Meta MMS engine — its `voiceName` is fixed, so the voice picker only applies to English.
 */
export const voiceLanguageSchema = z.enum(['en', 'ak']);
export type VoiceLanguage = z.infer<typeof voiceLanguageSchema>;
export const VOICE_LANGUAGE_LABELS: Record<VoiceLanguage, string> = {
  en: 'English',
  ak: 'Twi / Akan',
};

export const settingsUpdateSchema = z.object({
  retentionDays: z.coerce.number().int().min(1).max(3650).optional(),
  organizationName: z.string().max(120).optional(),
  /** ISO 3166-1 alpha-2 country code — drives "local number" detection for SMS + phone display. */
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Expected a 2-letter ISO country code')
    .optional(),
  dateFormat: dateFormatSchema.optional(),
  /** IANA timezone (e.g. Africa/Accra) used as the default for date display. */
  timeZone: z.string().max(64).optional(),
  /** AI read-aloud language + voice + speaking rate (TTS). Speed 0.5 = half, 2 = double. */
  voiceLanguage: voiceLanguageSchema.optional(),
  voiceName: voiceNameSchema.optional(),
  voiceSpeed: z.coerce.number().min(0.5).max(2).optional(),
});
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

// ── Device profiles / checkpoints ────────────────────────────────────────────
/** A registered device is also a checkpoint; its profile drives how check-in behaves on it. */
export const deviceTypeSchema = z.enum(['generic', 'zcs', 'sunmi', 'pax']);
export type DeviceType = z.infer<typeof deviceTypeSchema>;
export const scannerSourceSchema = z.enum(['camera', 'hardware']);
export const printerTargetSchema = z.enum(['off', 'vendor', 'network']);
export const credentialModeSchema = z.enum(['qr', 'printed', 'tag']);

export const deviceProfileSchema = z.object({
  /** Hardware family — selects which native bridge adapter the kiosk shell uses. */
  deviceType: deviceTypeSchema.default('generic'),
  /** `camera` = browser getUserMedia; `hardware` = the device's fixed scanner (native bridge). */
  scannerSource: scannerSourceSchema.default('camera'),
  printerTarget: printerTargetSchema.default('off'),
  networkPrinterUrl: z.url().optional(),
  nfcEnabled: z.boolean().default(false),
  /** What the visitor carries between checkpoints. */
  credentialMode: credentialModeSchema.default('qr'),
});
export type DeviceProfile = z.infer<typeof deviceProfileSchema>;
export const DEFAULT_DEVICE_PROFILE: DeviceProfile = deviceProfileSchema.parse({});

export const deviceUpsertSchema = z.object({
  deviceId: z.string().min(1).max(120),
  label: z.string().max(120).optional(),
  facilityId: z.uuid().optional(),
  /** The point this device is stationed at (reassignable; omit/null = unassigned spare). */
  pointId: z.uuid().nullish(),
  profile: deviceProfileSchema,
});
export type DeviceUpsertInput = z.infer<typeof deviceUpsertSchema>;

// ── Points (operating locations) + staffing assignments ──────────────────────
/** A point's category — mirrors the `point_kind` enum; behaviour comes from the device profile. */
export const POINT_KINDS = ['reception', 'security', 'checkpoint', 'exit', 'other'] as const;
export const pointKindSchema = z.enum(POINT_KINDS);
export type PointKind = z.infer<typeof pointKindSchema>;
export const POINT_KIND_LABELS: Record<PointKind, string> = {
  reception: 'Reception desk',
  security: 'Security check-point',
  checkpoint: 'Internal checkpoint',
  exit: 'Exit',
  other: 'Other',
};

export const pointCreateSchema = z.object({
  name: z.string().min(1).max(120),
  kind: pointKindSchema.default('checkpoint'),
  facilityId: z.uuid().nullish(),
});
export const pointUpdateSchema = pointCreateSchema.partial().extend({ id: z.uuid() });

/** Replace the full set of staff assigned to a point (who may sign a device in there). */
export const pointAssignSchema = z.object({
  pointId: z.uuid(),
  userIds: z.array(z.string()).max(500),
});
export type PointAssignInput = z.infer<typeof pointAssignSchema>;

/** A staff member signing a device in/out at its point (kiosk PostGate). */
export const deviceLoginSchema = z.object({ deviceId: z.string().min(1).max(120) });
export type DeviceLoginInput = z.infer<typeof deviceLoginSchema>;

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  generic: 'Generic (any tablet/phone)',
  zcs: 'ZCS terminal (e.g. Z92)',
  sunmi: 'Sunmi terminal',
  pax: 'PAX terminal',
};
export const SCANNER_SOURCE_LABELS: Record<z.infer<typeof scannerSourceSchema>, string> = {
  camera: 'Browser camera',
  hardware: 'Built-in hardware scanner',
};
export const PRINTER_TARGET_LABELS: Record<z.infer<typeof printerTargetSchema>, string> = {
  off: 'No printing',
  vendor: 'Built-in thermal printer',
  network: 'Network printer',
};
export const CREDENTIAL_MODE_LABELS: Record<z.infer<typeof credentialModeSchema>, string> = {
  qr: 'QR only',
  printed: 'Printed badge / slip',
  tag: 'Reusable tag / NFC',
};

// ── Visitor tags (reusable physical credentials, issued + returned at the desk) ──
export const tagKindSchema = z.enum(['number', 'nfc']);
export type TagKind = z.infer<typeof tagKindSchema>;

export const tagIssueSchema = z.object({
  visitId: z.uuid(),
  tagId: z.string().min(1).max(120),
  kind: tagKindSchema.default('number'),
  deviceId: z.string().max(120).optional(),
});
export type TagIssueInput = z.infer<typeof tagIssueSchema>;

export const tagReturnSchema = z.object({
  tagId: z.string().min(1).max(120),
  deviceId: z.string().max(120).optional(),
});
export type TagReturnInput = z.infer<typeof tagReturnSchema>;

// Staff accounts are invitation-based: the admin sets name/email/role and the new user
// receives an emailed link to set their own password (better-auth reset flow). No admin
// ever sets or sees a password. Department/office assign the user's place in the org so that
// appointments scheduled for them carry that context.
export const userCreateSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.email(),
  role: roleSchema,
  departmentId: z.uuid().optional(),
  officeId: z.uuid().optional(),
});
export const userSetRoleSchema = z.object({ userId: z.string(), role: roleSchema });
export const userBanSchema = z.object({ userId: z.string(), banned: z.boolean() });
/** Mark a staff member active/inactive for booking lists, with an optional reason note. */
export const userSetActiveSchema = z.object({
  userId: z.string(),
  isActive: z.boolean(),
  note: z.string().max(200).nullish(),
});
/** Edit an existing staff account's profile details (name / email / department / office). */
export const userUpdateSchema = z.object({
  userId: z.string(),
  name: z.string().min(1).max(120),
  email: z.email(),
  departmentId: z.uuid().nullish(),
  officeId: z.uuid().nullish(),
});
/** Re-send a "set your password" link to an existing staff account. */
export const userResetSchema = z.object({ email: z.email() });

/** Directory/HR host import (SRS §10.4) — a concrete, testable sync mechanism. */
export const directoryImportSchema = z.object({
  facilityId: z.uuid().optional(),
  hosts: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        email: z.email(),
        phone: z.string().max(40).optional(),
        externalId: z.string().max(120).optional(),
      }),
    )
    .min(1)
    .max(1000),
});
export type DirectoryImportInput = z.infer<typeof directoryImportSchema>;

// ── Reports (SRS §12) ───────────────────────────────────────────────────────
export const reportRangeSchema = z.object({
  facilityId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ReportRangeInput = z.infer<typeof reportRangeSchema>;

/** Visitor-insights search: find a recurring visitor by name, org, email or phone. */
export const visitorSearchSchema = z.object({
  q: z.string().trim().min(1).max(120),
});
export type VisitorSearchInput = z.infer<typeof visitorSearchSchema>;

/** Per-visitor analytics drill-down (visit frequency + purpose breakdown). */
export const visitorAnalyticsSchema = z.object({
  visitorId: z.uuid(),
});
export type VisitorAnalyticsInput = z.infer<typeof visitorAnalyticsSchema>;
