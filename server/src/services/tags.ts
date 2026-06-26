/**
 * Reusable visitor tags (numbered cards / NFC) — issued to a checked-in visitor and returned at the
 * desk. Returning a tag frees it for reuse AND checks the visitor out. `unreturnedTags` powers the
 * reconciliation report (who still holds a tag).
 */
import { and, desc, eq, isNull } from 'drizzle-orm';
import { schema, type TagIssueInput, type TagReturnInput } from '@vms/shared';
import { db } from '../db.ts';
import { checkOut } from './checkin.ts';

/** Issue a tag to a checked-in visit. Rejects if the visit isn't checked in or the tag is in use. */
export async function issueTag(input: TagIssueInput) {
  const [v] = await db
    .select({ status: schema.visit.status })
    .from(schema.visit)
    .where(eq(schema.visit.id, input.visitId));
  if (!v) return { ok: false as const, message: 'Visit not found.' };
  if (v.status !== 'checked_in') {
    return { ok: false as const, message: 'Visitor must be checked in before issuing a tag.' };
  }
  const [inUse] = await db
    .select({ id: schema.visitTag.id })
    .from(schema.visitTag)
    .where(and(eq(schema.visitTag.tagId, input.tagId), isNull(schema.visitTag.returnedAt)))
    .limit(1);
  if (inUse) return { ok: false as const, message: 'That tag is already issued to another visitor.' };

  const [row] = await db
    .insert(schema.visitTag)
    .values({
      visitId: input.visitId,
      tagId: input.tagId,
      kind: input.kind,
      issuedDeviceId: input.deviceId ?? null,
    })
    .returning();
  return { ok: true as const, id: row?.id, tagId: input.tagId };
}

/** Return a tag — marks it returned and checks the visitor out if still on-site. */
export async function returnTag(input: TagReturnInput, ctx: { ip: string }) {
  const [tag] = await db
    .select()
    .from(schema.visitTag)
    .where(and(eq(schema.visitTag.tagId, input.tagId), isNull(schema.visitTag.returnedAt)))
    .limit(1);
  if (!tag) return { ok: false as const, message: 'No active tag with that ID. Please see reception.' };

  await db
    .update(schema.visitTag)
    .set({ returnedAt: new Date(), returnedDeviceId: input.deviceId ?? null })
    .where(eq(schema.visitTag.id, tag.id));

  const [v] = await db
    .select({ status: schema.visit.status, visitorName: schema.visitor.fullName })
    .from(schema.visit)
    .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
    .where(eq(schema.visit.id, tag.visitId));

  let checkedOut = false;
  if (v?.status === 'checked_in') {
    await checkOut(tag.visitId, { ip: ctx.ip, deviceId: input.deviceId });
    checkedOut = true;
  }
  return { ok: true as const, visitId: tag.visitId, visitorName: v?.visitorName ?? null, checkedOut };
}

/** Tags still out (not returned) — the reconciliation report. */
export function unreturnedTags() {
  return db
    .select({
      id: schema.visitTag.id,
      tagId: schema.visitTag.tagId,
      kind: schema.visitTag.kind,
      issuedAt: schema.visitTag.issuedAt,
      visitId: schema.visitTag.visitId,
      visitorName: schema.visitor.fullName,
      status: schema.visit.status,
    })
    .from(schema.visitTag)
    .leftJoin(schema.visit, eq(schema.visit.id, schema.visitTag.visitId))
    .leftJoin(schema.visitor, eq(schema.visitor.id, schema.visit.visitorId))
    .where(isNull(schema.visitTag.returnedAt))
    .orderBy(desc(schema.visitTag.issuedAt));
}
