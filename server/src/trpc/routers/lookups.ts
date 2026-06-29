import { and, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '@vms/shared';
import { db } from '../../db.ts';
import { getLogoVersion, getPolicyContent, getSettings } from '../../services/admin.ts';
import { actorOfficeId, isSecretaryOnly } from '../../services/scope.ts';
import { protectedProcedure, publicProcedure, router } from '../trpc.ts';

/** Read-only lookups that populate appointment forms. Available to any authenticated staff. */
export const lookupsRouter = router({
  /**
   * Non-sensitive display config for forms/kiosks — notably the country whose dial code prefixes
   * every phone field. Public so the visitor-facing pre-registration page can read it too.
   */
  publicConfig: publicProcedure.query(async () => {
    const s = await getSettings();
    return {
      country: s.country,
      dateFormat: s.dateFormat,
      organizationName: s.organizationName,
      brandColor: s.brandColor,
      // Institution contact shown to visitors on the pre-registration page.
      contactEmail: s.contactEmail,
      contactPhone: s.contactPhone,
      // Version stamp only — the actual image bytes come from GET /api/v1/branding/logo.
      logoVersion: await getLogoVersion(),
    };
  }),

  /**
   * Visitor-facing policy text (site rules, privacy notice) keyed by policy code. Public so the
   * standalone `/policy/:key` reader page (opened in a new tab from pre-registration) can load it.
   */
  policies: publicProcedure.query(() => getPolicyContent()),

  facilities: protectedProcedure.query(() =>
    db
      .select({ id: schema.facility.id, name: schema.facility.name, code: schema.facility.code })
      .from(schema.facility)
      .where(eq(schema.facility.isActive, true)),
  ),

  categories: protectedProcedure.query(() =>
    db
      .select({
        id: schema.visitorCategory.id,
        name: schema.visitorCategory.name,
        requiresApproval: schema.visitorCategory.requiresApproval,
      })
      .from(schema.visitorCategory)
      .where(eq(schema.visitorCategory.isActive, true)),
  ),

  /**
   * The signed-in user's own host record, if they have one — lets an officer book a visit for
   * themselves without re-picking their department, office and name. Null for staff (e.g. a
   * receptionist) who aren't set up as a bookable officer.
   */
  myHost: protectedProcedure.query(async ({ ctx }) => {
    const [h] = await db
      .select({
        id: schema.host.id,
        name: schema.host.name,
        email: schema.host.email,
        isActive: schema.host.isActive,
        departmentName: schema.department.name,
        officeName: schema.office.name,
      })
      .from(schema.host)
      .leftJoin(schema.department, eq(schema.department.id, schema.host.departmentId))
      .leftJoin(schema.office, eq(schema.office.id, schema.host.officeId))
      .where(eq(schema.host.userId, ctx.user.id));
    return h ?? null;
  }),

  hosts: protectedProcedure
    .input(z.object({ q: z.string().max(120).optional() }))
    .query(async ({ input, ctx }) => {
      const filters = [eq(schema.host.isActive, true)];
      if (input.q) {
        const q = `%${input.q}%`;
        filters.push(or(ilike(schema.host.name, q), ilike(schema.host.email, q))!);
      }
      // Secretaries may only see/book officers in their own office (secure-by-default).
      const role = (ctx.user as { role?: string | null }).role ?? null;
      if (isSecretaryOnly(role)) {
        const officeId = await actorOfficeId(ctx.user.id);
        if (!officeId) return [];
        filters.push(eq(schema.host.officeId, officeId));
      }
      return db
        .select({
          id: schema.host.id,
          name: schema.host.name,
          email: schema.host.email,
          departmentName: schema.department.name,
          officeName: schema.office.name,
        })
        .from(schema.host)
        .leftJoin(schema.department, eq(schema.department.id, schema.host.departmentId))
        .leftJoin(schema.office, eq(schema.office.id, schema.host.officeId))
        .where(and(...filters))
        .limit(20);
    }),

  // ── Cascading pickers: Department → Office → Officer (avoids one tall host list) ──
  departments: protectedProcedure.query(() =>
    db
      .select({ id: schema.department.id, name: schema.department.name })
      .from(schema.department)
      .where(eq(schema.department.isActive, true))
      .orderBy(schema.department.name),
  ),

  officesByDepartment: protectedProcedure
    .input(z.object({ departmentId: z.uuid() }))
    .query(({ input }) =>
      db
        .select({ id: schema.office.id, name: schema.office.name })
        .from(schema.office)
        .where(
          and(eq(schema.office.departmentId, input.departmentId), eq(schema.office.isActive, true)),
        )
        .orderBy(schema.office.name),
    ),

  hostsByOffice: protectedProcedure
    .input(z.object({ officeId: z.uuid() }))
    .query(async ({ input, ctx }) => {
      // Secretaries may only list officers in their own office.
      const role = (ctx.user as { role?: string | null }).role ?? null;
      if (isSecretaryOnly(role) && (await actorOfficeId(ctx.user.id)) !== input.officeId) {
        return [];
      }
      return db
        .select({ id: schema.host.id, name: schema.host.name, email: schema.host.email })
        .from(schema.host)
        .where(and(eq(schema.host.officeId, input.officeId), eq(schema.host.isActive, true)))
        .orderBy(schema.host.name);
    }),
});
