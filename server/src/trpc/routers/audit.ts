import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { auditListSchema, schema } from '@vms/shared';
import { db } from '../../db.ts';
import { authorized } from '../permission.ts';
import { router } from '../trpc.ts';

export const auditRouter = router({
  /** Filterable, read-only audit trail (SRS §11.3). */
  list: authorized({ audit: ['read'] })
    .input(auditListSchema)
    .query(async ({ input }) => {
      const conditions = [];
      if (input.actorId) conditions.push(eq(schema.auditLog.actorId, input.actorId));
      if (input.action) conditions.push(ilike(schema.auditLog.action, `%${input.action}%`));
      if (input.objectType) conditions.push(eq(schema.auditLog.objectType, input.objectType));
      if (input.result) conditions.push(eq(schema.auditLog.result, input.result));
      if (input.from) conditions.push(gte(schema.auditLog.createdAt, input.from));
      if (input.to) conditions.push(lte(schema.auditLog.createdAt, input.to));
      const where = conditions.length ? and(...conditions) : undefined;

      const items = await db
        .select({
          id: schema.auditLog.id,
          action: schema.auditLog.action,
          objectType: schema.auditLog.objectType,
          objectId: schema.auditLog.objectId,
          result: schema.auditLog.result,
          actorRole: schema.auditLog.actorRole,
          actorEmail: schema.user.email,
          sourceIp: schema.auditLog.sourceIp,
          createdAt: schema.auditLog.createdAt,
        })
        .from(schema.auditLog)
        .leftJoin(schema.user, eq(schema.user.id, schema.auditLog.actorId))
        .where(where)
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      const [{ count } = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.auditLog)
        .where(where);

      return { items, total: count, page: input.page, pageSize: input.pageSize };
    }),
});
