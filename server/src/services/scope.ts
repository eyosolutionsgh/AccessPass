/**
 * Office-scoped authorization for secretaries (SRS scope rule). A secretary may book/reschedule
 * ONLY for officers in their OWN office. The `authorized()` middleware checks role→permission but
 * has no row context, so the office check lives here in the service layer where the target host
 * (and thus its office) is known.
 */
import { eq } from 'drizzle-orm';
import { ROLES, schema } from '@vms/shared';
import { db } from '../db.ts';

type Actor = { id: string; role?: string | null };

/** Thrown when a secretary tries to act outside their office; the tRPC layer maps it to 403. */
export class ForbiddenScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenScopeError';
  }
}

function rolesOf(roleField?: string | null): string[] {
  return (roleField ?? '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
}

/**
 * True when the actor is ONLY a secretary. Someone who is also a receptionist/admin/host books
 * org-wide, so the office restriction must NOT apply to them (it would over-restrict).
 */
export function isSecretaryOnly(roleField?: string | null): boolean {
  const rs = rolesOf(roleField);
  if (!rs.includes(ROLES.secretary)) return false;
  return !rs.some((r) => r === ROLES.receptionist || r === ROLES.admin || r === ROLES.host);
}

/** The office the staff user belongs to (via their mirrored host row), or null if none. */
export async function actorOfficeId(userId: string): Promise<string | null> {
  const [h] = await db
    .select({ officeId: schema.host.officeId })
    .from(schema.host)
    .where(eq(schema.host.userId, userId));
  return h?.officeId ?? null;
}

/**
 * Enforce that a secretary-only actor may only act on a host in their own office. No-op for any
 * other actor. Fails closed (a secretary with no office assigned cannot book at all).
 */
export async function assertSecretaryScope(
  actor: Actor,
  targetHostId: string | null,
): Promise<void> {
  if (!isSecretaryOnly(actor.role)) return;
  // A host-less visit (walk-in directed only to a department/office) has no officer to scope to.
  if (!targetHostId) return;
  const officeId = await actorOfficeId(actor.id);
  if (!officeId) {
    throw new ForbiddenScopeError(
      'You are not assigned to an office, so you cannot book appointments. Ask an admin to set your office.',
    );
  }
  const [target] = await db
    .select({ officeId: schema.host.officeId })
    .from(schema.host)
    .where(eq(schema.host.id, targetHostId));
  if (!target || target.officeId !== officeId) {
    throw new ForbiddenScopeError('Secretaries can only book for officers in their own office.');
  }
}
