/**
 * Visitor directory — front-desk lookup and standalone capture, independent of any appointment.
 * Lets reception log a person's details so they can be picked later when scheduling (SRS §9.1).
 */
import { eq } from 'drizzle-orm';
import { type CreateVisitorInput, schema } from '@vms/shared';
import { db } from '../db.ts';
import { recordAudit } from '../lib/audit.ts';

type Actor = { id: string; role?: string | null };

/** A single directory visitor's basic details (for prefilling a follow-up booking). */
export async function getDirectoryVisitor(visitorId: string) {
  const [v] = await db
    .select({
      visitorId: schema.visitor.id,
      fullName: schema.visitor.fullName,
      organization: schema.visitor.organization,
      email: schema.visitor.email,
      phone: schema.visitor.phone,
    })
    .from(schema.visitor)
    .where(eq(schema.visitor.id, visitorId));
  return v ?? null;
}

const nz = (v: string | undefined): string | null => (v && v.trim() ? v.trim() : null);

/** Add a person to the visitor directory without creating a visit (for later scheduling). */
export async function createDirectoryVisitor(input: CreateVisitorInput, actor: Actor) {
  const [created] = await db
    .insert(schema.visitor)
    .values({
      fullName: input.fullName.trim(),
      organization: nz(input.organization),
      email: nz(input.email),
      phone: nz(input.phone),
      notes: nz(input.notes),
    })
    .returning();
  if (!created) throw new Error('Failed to create visitor');

  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'visitor.create',
    objectType: 'visitor',
    objectId: created.id,
  });
  return created;
}
