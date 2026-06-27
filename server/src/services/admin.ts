import { desc, eq, sql } from 'drizzle-orm';
import {
  DEFAULT_DEVICE_PROFILE,
  schema,
  type AdminSetActiveInput,
  type DateFormat,
  type DeviceProfile,
  type DeviceUpsertInput,
  type DirectoryImportInput,
  type SettingsUpdateInput,
  type VoiceLanguage,
  type VoiceName,
  type categoryCreateSchema,
  type categoryUpdateSchema,
  type departmentCreateSchema,
  type departmentUpdateSchema,
  type officeCreateSchema,
  type officeUpdateSchema,
  type facilityCreateSchema,
  type facilityUpdateSchema,
} from '@vms/shared';
import { type z } from 'zod';
import { ORGANIZATION_NAME } from '../config.ts';
import { db } from '../db.ts';
import { env } from '../env.ts';
import { recordAudit } from '../lib/audit.ts';

type Actor = { id: string; role?: string | null };

// ── Settings (key/value) ────────────────────────────────────────────────────
const RETENTION_KEY = 'retention_days';
const ORG_KEY = 'organization_name';
const COUNTRY_KEY = 'country';
const DATE_FORMAT_KEY = 'date_format';
const TIME_ZONE_KEY = 'time_zone';
const VOICE_LANGUAGE_KEY = 'voice_language';
const VOICE_NAME_KEY = 'voice_name';
const VOICE_SPEED_KEY = 'voice_speed';

/** Defaults reflect the primary deployment locale; all are admin-overridable without a deploy. */
const DEFAULT_COUNTRY = 'GH';
const DEFAULT_DATE_FORMAT: DateFormat = 'DD/MM/YYYY';
const DEFAULT_TIME_ZONE = 'Africa/Accra';
const DEFAULT_VOICE_LANGUAGE: VoiceLanguage = 'en';
const DEFAULT_VOICE_NAME: VoiceName = 'nova';
const DEFAULT_VOICE_SPEED = 1;

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(schema.setting).where(eq(schema.setting.key, key));
  return (row?.value as T) ?? fallback;
}

async function setSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(schema.setting)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.setting.key, set: { value, updatedAt: new Date() } });
}

export async function getSettings() {
  return {
    retentionDays: await getSetting(RETENTION_KEY, env.RETENTION_DAYS_DEFAULT),
    organizationName: await getSetting<string | null>(ORG_KEY, null),
    country: await getSetting(COUNTRY_KEY, DEFAULT_COUNTRY),
    dateFormat: await getSetting<DateFormat>(DATE_FORMAT_KEY, DEFAULT_DATE_FORMAT),
    timeZone: await getSetting(TIME_ZONE_KEY, DEFAULT_TIME_ZONE),
    voiceLanguage: await getSetting<VoiceLanguage>(VOICE_LANGUAGE_KEY, DEFAULT_VOICE_LANGUAGE),
    voiceName: await getSetting<VoiceName>(VOICE_NAME_KEY, DEFAULT_VOICE_NAME),
    voiceSpeed: await getSetting(VOICE_SPEED_KEY, DEFAULT_VOICE_SPEED),
  };
}

export async function updateSettings(input: SettingsUpdateInput, actor: Actor) {
  if (input.retentionDays !== undefined) await setSetting(RETENTION_KEY, input.retentionDays);
  if (input.organizationName !== undefined) await setSetting(ORG_KEY, input.organizationName);
  if (input.country !== undefined) await setSetting(COUNTRY_KEY, input.country);
  if (input.dateFormat !== undefined) await setSetting(DATE_FORMAT_KEY, input.dateFormat);
  if (input.timeZone !== undefined) await setSetting(TIME_ZONE_KEY, input.timeZone);
  if (input.voiceLanguage !== undefined) await setSetting(VOICE_LANGUAGE_KEY, input.voiceLanguage);
  if (input.voiceName !== undefined) await setSetting(VOICE_NAME_KEY, input.voiceName);
  if (input.voiceSpeed !== undefined) await setSetting(VOICE_SPEED_KEY, input.voiceSpeed);
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'settings.update',
    objectType: 'setting',
    metadata: input,
  });
  return getSettings();
}

/** Retention period in days (config, with env fallback) — used by the retention job. */
export function getRetentionDays(): Promise<number> {
  return getSetting(RETENTION_KEY, env.RETENTION_DAYS_DEFAULT);
}

/** Configured default country (ISO-2) — drives "local number" detection for SMS. */
export function getCountry(): Promise<string> {
  return getSetting(COUNTRY_KEY, DEFAULT_COUNTRY);
}

/**
 * The institution name shown to visitors in notifications (invitation, decline, SMS) and as the
 * email sender name, so recipients recognise who is contacting them. Falls back to a generic label
 * until an administrator sets it under Admin → Settings.
 */
export async function getOrganizationName(): Promise<string> {
  const v = await getSetting<string | null>(ORG_KEY, null);
  return v?.trim() || ORGANIZATION_NAME;
}

/** Date-display preferences for rendering dates in notifications/UI. */
export async function getDateDisplay(): Promise<{ dateFormat: DateFormat; timeZone: string }> {
  return {
    dateFormat: await getSetting<DateFormat>(DATE_FORMAT_KEY, DEFAULT_DATE_FORMAT),
    timeZone: await getSetting(TIME_ZONE_KEY, DEFAULT_TIME_ZONE),
  };
}

/** Configured AI read-aloud language + voice + speaking rate (TTS) — used by the speak endpoint. */
export async function getVoiceSettings(): Promise<{
  language: VoiceLanguage;
  voice: VoiceName;
  speed: number;
}> {
  return {
    language: await getSetting<VoiceLanguage>(VOICE_LANGUAGE_KEY, DEFAULT_VOICE_LANGUAGE),
    voice: await getSetting<VoiceName>(VOICE_NAME_KEY, DEFAULT_VOICE_NAME),
    speed: await getSetting(VOICE_SPEED_KEY, DEFAULT_VOICE_SPEED),
  };
}

// ── Devices / checkpoints ─────────────────────────────────────────────────────
export function listDeviceProfiles() {
  return db.select().from(schema.deviceProfile).orderBy(desc(schema.deviceProfile.createdAt));
}

/** Resolve a device's profile (the kiosk reads this by its deviceId). Defaults when unregistered. */
export async function getDeviceProfile(deviceId: string): Promise<DeviceProfile> {
  const [row] = await db
    .select({ profile: schema.deviceProfile.profile })
    .from(schema.deviceProfile)
    .where(eq(schema.deviceProfile.deviceId, deviceId));
  return (row?.profile as DeviceProfile | undefined) ?? DEFAULT_DEVICE_PROFILE;
}

export async function upsertDeviceProfile(input: DeviceUpsertInput, actor: Actor) {
  // A device inherits its facility from the point it's stationed at (the point is the location);
  // fall back to any explicitly-passed facilityId for unassigned/spare devices.
  let facilityId = input.facilityId ?? null;
  if (input.pointId) {
    const [pt] = await db
      .select({ facilityId: schema.point.facilityId })
      .from(schema.point)
      .where(eq(schema.point.id, input.pointId));
    facilityId = pt?.facilityId ?? facilityId;
  }
  const values = {
    deviceId: input.deviceId,
    label: input.label ?? null,
    facilityId,
    pointId: input.pointId ?? null,
    profile: input.profile,
  };
  const [row] = await db
    .insert(schema.deviceProfile)
    .values(values)
    .onConflictDoUpdate({
      target: schema.deviceProfile.deviceId,
      set: {
        label: values.label,
        facilityId: values.facilityId,
        pointId: values.pointId,
        profile: values.profile,
        updatedAt: new Date(),
      },
    })
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'device_profile.upsert',
    objectType: 'device_profile',
    objectId: row?.id,
    metadata: { deviceId: input.deviceId },
  });
  return row;
}

/**
 * Soft-delete / restore a checkpoint (device profile). Deactivating keeps the device's checkpoint
 * trail intact and drops it out of the active checkpoint list, without un-registering the device.
 */
export async function setCheckpointActive(input: AdminSetActiveInput, actor: Actor) {
  const [row] = await db
    .update(schema.deviceProfile)
    .set({ isActive: input.isActive })
    .where(eq(schema.deviceProfile.id, input.id))
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'device_profile.set_active',
    objectType: 'device_profile',
    objectId: input.id,
    metadata: { isActive: input.isActive },
  });
  return row;
}

// ── Facility ────────────────────────────────────────────────────────────────
export function listFacilities() {
  return db.select().from(schema.facility).orderBy(desc(schema.facility.createdAt));
}

export async function createFacility(input: z.infer<typeof facilityCreateSchema>, actor: Actor) {
  const [row] = await db.insert(schema.facility).values(input).returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'facility.create',
    objectType: 'facility',
    objectId: row?.id,
  });
  return row;
}

export async function updateFacility(input: z.infer<typeof facilityUpdateSchema>, actor: Actor) {
  const { id, ...rest } = input;
  const [row] = await db
    .update(schema.facility)
    .set(rest)
    .where(eq(schema.facility.id, id))
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'facility.update',
    objectType: 'facility',
    objectId: id,
  });
  return row;
}

/** Soft-delete / restore a facility (sets isActive). Deactivated facilities drop out of pickers. */
export async function setFacilityActive(input: AdminSetActiveInput, actor: Actor) {
  const [row] = await db
    .update(schema.facility)
    .set({ isActive: input.isActive })
    .where(eq(schema.facility.id, input.id))
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'facility.set_active',
    objectType: 'facility',
    objectId: input.id,
    metadata: { isActive: input.isActive },
  });
  return row;
}

// ── Visitor categories ──────────────────────────────────────────────────────
export function listCategories() {
  return db.select().from(schema.visitorCategory).orderBy(desc(schema.visitorCategory.createdAt));
}

export async function createCategory(input: z.infer<typeof categoryCreateSchema>, actor: Actor) {
  const [row] = await db.insert(schema.visitorCategory).values(input).returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'category.create',
    objectType: 'visitor_category',
    objectId: row?.id,
  });
  return row;
}

export async function updateCategory(input: z.infer<typeof categoryUpdateSchema>, actor: Actor) {
  const { id, ...rest } = input;
  const [row] = await db
    .update(schema.visitorCategory)
    .set(rest)
    .where(eq(schema.visitorCategory.id, id))
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'category.update',
    objectType: 'visitor_category',
    objectId: id,
  });
  return row;
}

/** Soft-delete / restore a visitor category (sets isActive). Inactive categories drop out of forms. */
export async function setCategoryActive(input: AdminSetActiveInput, actor: Actor) {
  const [row] = await db
    .update(schema.visitorCategory)
    .set({ isActive: input.isActive })
    .where(eq(schema.visitorCategory.id, input.id))
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'category.set_active',
    objectType: 'visitor_category',
    objectId: input.id,
    metadata: { isActive: input.isActive },
  });
  return row;
}

// ── Departments / divisions ─────────────────────────────────────────────────
export function listDepartments() {
  return db
    .select({
      id: schema.department.id,
      name: schema.department.name,
      facilityId: schema.department.facilityId,
      facilityName: schema.facility.name,
      isActive: schema.department.isActive,
      createdAt: schema.department.createdAt,
    })
    .from(schema.department)
    .leftJoin(schema.facility, eq(schema.facility.id, schema.department.facilityId))
    .orderBy(desc(schema.department.createdAt));
}

export async function createDepartment(
  input: z.infer<typeof departmentCreateSchema>,
  actor: Actor,
) {
  const [row] = await db
    .insert(schema.department)
    .values({ name: input.name, facilityId: input.facilityId ?? null })
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'department.create',
    objectType: 'department',
    objectId: row?.id,
  });
  return row;
}

export async function updateDepartment(
  input: z.infer<typeof departmentUpdateSchema>,
  actor: Actor,
) {
  const { id, ...rest } = input;
  const [row] = await db
    .update(schema.department)
    .set(rest)
    .where(eq(schema.department.id, id))
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'department.update',
    objectType: 'department',
    objectId: id,
  });
  return row;
}

/**
 * Soft-delete / restore a department (sets isActive). Deactivating keeps its offices and any
 * host/visit references intact, but drops it out of every booking lookup.
 */
export async function setDepartmentActive(input: AdminSetActiveInput, actor: Actor) {
  const [row] = await db
    .update(schema.department)
    .set({ isActive: input.isActive })
    .where(eq(schema.department.id, input.id))
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'department.set_active',
    objectType: 'department',
    objectId: input.id,
    metadata: { isActive: input.isActive },
  });
  return row;
}

// ── Offices / rooms ──────────────────────────────────────────────────────────
export function listOffices() {
  return db
    .select({
      id: schema.office.id,
      name: schema.office.name,
      departmentId: schema.office.departmentId,
      departmentName: schema.department.name,
      isActive: schema.office.isActive,
      createdAt: schema.office.createdAt,
    })
    .from(schema.office)
    .leftJoin(schema.department, eq(schema.department.id, schema.office.departmentId))
    .orderBy(desc(schema.office.createdAt));
}

export async function createOffice(input: z.infer<typeof officeCreateSchema>, actor: Actor) {
  const [row] = await db
    .insert(schema.office)
    .values({ name: input.name, departmentId: input.departmentId })
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'office.create',
    objectType: 'office',
    objectId: row?.id,
  });
  return row;
}

export async function updateOffice(input: z.infer<typeof officeUpdateSchema>, actor: Actor) {
  const { id, ...rest } = input;
  const [row] = await db
    .update(schema.office)
    .set(rest)
    .where(eq(schema.office.id, id))
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'office.update',
    objectType: 'office',
    objectId: id,
  });
  return row;
}

/** Soft-delete / restore an office (sets isActive). Inactive offices drop out of booking pickers. */
export async function setOfficeActive(input: AdminSetActiveInput, actor: Actor) {
  const [row] = await db
    .update(schema.office)
    .set({ isActive: input.isActive })
    .where(eq(schema.office.id, input.id))
    .returning();
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'office.set_active',
    objectType: 'office',
    objectId: input.id,
    metadata: { isActive: input.isActive },
  });
  return row;
}

/**
 * Mirror a staff login into the `host` table so it can host visits and carry the user's
 * department/office. Reuses an existing host row matched by userId (or by email, e.g. one synced
 * from the directory) and links it to the login. Facility is derived from the department.
 */
export async function syncUserHost(input: {
  userId: string;
  name: string;
  email: string;
  departmentId?: string | null;
  officeId?: string | null;
}) {
  let facilityId: string | null = null;
  if (input.departmentId) {
    const [dept] = await db
      .select({ facilityId: schema.department.facilityId })
      .from(schema.department)
      .where(eq(schema.department.id, input.departmentId));
    facilityId = dept?.facilityId ?? null;
  }

  const [byUser] = await db.select().from(schema.host).where(eq(schema.host.userId, input.userId));
  const existing =
    byUser ?? (await db.select().from(schema.host).where(eq(schema.host.email, input.email)))[0];

  const set = {
    userId: input.userId,
    name: input.name,
    email: input.email,
    departmentId: input.departmentId ?? null,
    officeId: input.officeId ?? null,
    facilityId,
  };

  if (existing) {
    // Preserve isActive — a profile/department edit must NOT silently reactivate a host an admin
    // deactivated (resigned/on leave). Activation is changed only via setUserActive.
    await db.update(schema.host).set(set).where(eq(schema.host.id, existing.id));
  } else {
    await db.insert(schema.host).values({ ...set, isActive: true });
  }
}

/**
 * Mark a staff member's host record active/inactive. Inactive hosts drop out of every booking
 * lookup (all filter `isActive = true`), so they no longer appear as bookable officers. The
 * optional note records why (e.g. "resigned", "on leave"). Login/role are unaffected.
 */
export async function setUserActive(
  input: { userId: string; isActive: boolean; note?: string | null },
  actor: Actor,
) {
  const [host] = await db
    .select({ id: schema.host.id })
    .from(schema.host)
    .where(eq(schema.host.userId, input.userId));
  if (!host) throw new Error('No staff/host record found for this user');
  await db
    .update(schema.host)
    .set({ isActive: input.isActive, availabilityNote: input.note ?? null })
    .where(eq(schema.host.id, host.id));
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'user.set_active',
    objectType: 'host',
    objectId: host.id,
    metadata: { isActive: input.isActive },
  });
}

// ── Directory/HR host import (SRS §10.4) ────────────────────────────────────
export async function importHosts(input: DirectoryImportInput, actor: Actor) {
  let created = 0;
  let updated = 0;
  for (const h of input.hosts) {
    const [existing] = await db.select().from(schema.host).where(eq(schema.host.email, h.email));
    if (existing) {
      await db
        .update(schema.host)
        .set({ name: h.name, phone: h.phone, externalId: h.externalId, isActive: true })
        .where(eq(schema.host.id, existing.id));
      updated++;
    } else {
      await db.insert(schema.host).values({
        name: h.name,
        email: h.email,
        phone: h.phone,
        externalId: h.externalId,
        facilityId: input.facilityId,
      });
      created++;
    }
  }
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'directory.import',
    objectType: 'host',
    metadata: { created, updated, total: input.hosts.length },
  });
  return { created, updated, total: input.hosts.length };
}

export async function countHosts() {
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.host);
  return count;
}
