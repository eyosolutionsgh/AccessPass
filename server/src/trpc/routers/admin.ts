import { fromNodeHeaders } from 'better-auth/node';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  adminSetActiveSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  departmentCreateSchema,
  departmentUpdateSchema,
  deviceUpsertSchema,
  devicePairSchema,
  directoryImportSchema,
  officeCreateSchema,
  officeUpdateSchema,
  facilityCreateSchema,
  facilityUpdateSchema,
  logoUploadSchema,
  pointAssignSchema,
  pointCreateSchema,
  pointUpdateSchema,
  schema,
  settingsUpdateSchema,
  userBanSchema,
  userCreateSchema,
  userResetSchema,
  userSetActiveSchema,
  userSetRoleSchema,
  userUpdateSchema,
} from '@vms/shared';
import { auth } from '../../auth.ts';
import { db } from '../../db.ts';
import { env } from '../../env.ts';
import * as admin from '../../services/admin.ts';
import * as points from '../../services/points.ts';
import { checkpointLog } from '../../services/checkpoints.ts';
import { actorFrom, authorized } from '../permission.ts';
import { router } from '../trpc.ts';

const headersOf = (ctx: { req: { headers: Record<string, string | string[] | undefined> } }) =>
  fromNodeHeaders(ctx.req.headers);

/** Where the emailed reset link lands the user (a public web route, see apps/web). */
const RESET_REDIRECT_URL = `${env.WEB_ORIGIN}/reset-password`;

/** Trigger better-auth's reset flow so `email` receives a "set your password" link. */
const sendPasswordLink = (
  email: string,
  ctx: { req: { headers: Record<string, string | string[] | undefined> } },
) =>
  auth.api.requestPasswordReset({
    body: { email, redirectTo: RESET_REDIRECT_URL },
    headers: headersOf(ctx),
  });

export const adminRouter = router({
  // ── Facility ──
  facilityList: authorized({ config: ['read'] }).query(() => admin.listFacilities()),
  facilityCreate: authorized({ config: ['manage'] })
    .input(facilityCreateSchema)
    .mutation(({ input, ctx }) => admin.createFacility(input, actorFrom(ctx.user))),
  facilityUpdate: authorized({ config: ['manage'] })
    .input(facilityUpdateSchema)
    .mutation(({ input, ctx }) => admin.updateFacility(input, actorFrom(ctx.user))),
  facilitySetActive: authorized({ config: ['manage'] })
    .input(adminSetActiveSchema)
    .mutation(({ input, ctx }) => admin.setFacilityActive(input, actorFrom(ctx.user))),

  // ── Visitor categories ──
  categoryList: authorized({ config: ['read'] }).query(() => admin.listCategories()),
  categoryCreate: authorized({ config: ['manage'] })
    .input(categoryCreateSchema)
    .mutation(({ input, ctx }) => admin.createCategory(input, actorFrom(ctx.user))),
  categoryUpdate: authorized({ config: ['manage'] })
    .input(categoryUpdateSchema)
    .mutation(({ input, ctx }) => admin.updateCategory(input, actorFrom(ctx.user))),
  categorySetActive: authorized({ config: ['manage'] })
    .input(adminSetActiveSchema)
    .mutation(({ input, ctx }) => admin.setCategoryActive(input, actorFrom(ctx.user))),

  // ── Departments / divisions ──
  departmentList: authorized({ config: ['read'] }).query(() => admin.listDepartments()),
  departmentCreate: authorized({ config: ['manage'] })
    .input(departmentCreateSchema)
    .mutation(({ input, ctx }) => admin.createDepartment(input, actorFrom(ctx.user))),
  departmentUpdate: authorized({ config: ['manage'] })
    .input(departmentUpdateSchema)
    .mutation(({ input, ctx }) => admin.updateDepartment(input, actorFrom(ctx.user))),
  departmentSetActive: authorized({ config: ['manage'] })
    .input(adminSetActiveSchema)
    .mutation(({ input, ctx }) => admin.setDepartmentActive(input, actorFrom(ctx.user))),

  // ── Offices / rooms ──
  officeList: authorized({ config: ['read'] }).query(() => admin.listOffices()),
  officeCreate: authorized({ config: ['manage'] })
    .input(officeCreateSchema)
    .mutation(({ input, ctx }) => admin.createOffice(input, actorFrom(ctx.user))),
  officeUpdate: authorized({ config: ['manage'] })
    .input(officeUpdateSchema)
    .mutation(({ input, ctx }) => admin.updateOffice(input, actorFrom(ctx.user))),
  officeSetActive: authorized({ config: ['manage'] })
    .input(adminSetActiveSchema)
    .mutation(({ input, ctx }) => admin.setOfficeActive(input, actorFrom(ctx.user))),

  // ── Settings (retention, org name) ──
  settingsGet: authorized({ config: ['read'] }).query(() => admin.getSettings()),
  settingsUpdate: authorized({ config: ['manage'] })
    .input(settingsUpdateSchema)
    .mutation(({ input, ctx }) => admin.updateSettings(input, actorFrom(ctx.user))),

  // ── Institution logo (overrides the bundled default everywhere it's shown) ──
  logoSet: authorized({ config: ['manage'] })
    .input(logoUploadSchema)
    .mutation(({ input, ctx }) => admin.setLogo(input.dataUrl, actorFrom(ctx.user))),
  logoClear: authorized({ config: ['manage'] }).mutation(({ ctx }) =>
    admin.clearLogo(actorFrom(ctx.user)),
  ),

  // ── Points (operating locations) + staffing ──
  pointList: authorized({ config: ['read'] }).query(() => points.listPoints()),
  pointCreate: authorized({ config: ['manage'] })
    .input(pointCreateSchema)
    .mutation(({ input, ctx }) => points.createPoint(input, actorFrom(ctx.user))),
  pointUpdate: authorized({ config: ['manage'] })
    .input(pointUpdateSchema)
    .mutation(({ input, ctx }) => points.updatePoint(input, actorFrom(ctx.user))),
  pointSetActive: authorized({ config: ['manage'] })
    .input(adminSetActiveSchema)
    .mutation(({ input, ctx }) => points.setPointActive(input, actorFrom(ctx.user))),
  pointAssignmentsGet: authorized({ config: ['read'] })
    .input(z.object({ pointId: z.uuid() }))
    .query(({ input }) => points.listPointAssignments(input.pointId)),
  pointAssignmentsSet: authorized({ config: ['manage'] })
    .input(pointAssignSchema)
    .mutation(({ input, ctx }) => points.setPointAssignments(input, actorFrom(ctx.user))),

  // ── Devices / checkpoints ──
  devicesList: authorized({ config: ['read'] }).query(() => admin.listDeviceProfiles()),
  /** Devices with their point + who is currently signed in — the staffing oversight view. */
  devicesStatus: authorized({ config: ['read'] }).query(() => points.devicesStatus()),
  deviceUpsert: authorized({ config: ['manage'] })
    .input(deviceUpsertSchema)
    .mutation(({ input, ctx }) => admin.upsertDeviceProfile(input, actorFrom(ctx.user))),
  /** Mint a one-time code an operator types on the tablet to bind it to this device. */
  devicePair: authorized({ config: ['manage'] })
    .input(devicePairSchema)
    .mutation(({ input, ctx }) => points.createDevicePairing(input.deviceId, actorFrom(ctx.user))),
  checkpointSetActive: authorized({ config: ['manage'] })
    .input(adminSetActiveSchema)
    .mutation(({ input, ctx }) => admin.setCheckpointActive(input, actorFrom(ctx.user))),
  checkpointLog: authorized({ config: ['read'] })
    .input(
      z.object({
        deviceId: z.string().max(120),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(({ input }) => checkpointLog(input.deviceId, input.limit)),

  // ── Directory/HR host import ──
  importHosts: authorized({ config: ['manage'] })
    .input(directoryImportSchema)
    .mutation(({ input, ctx }) => admin.importHosts(input, actorFrom(ctx.user))),

  // ── Staff users (better-auth admin plugin) ──
  userList: authorized({ user: ['list'] }).query(async ({ ctx }) => {
    const res = (await auth.api.listUsers({
      query: { limit: 200, sortBy: 'createdAt', sortDirection: 'desc' },
      headers: headersOf(ctx),
    })) as {
      users: Array<{
        id: string;
        name: string;
        email: string;
        role?: string;
        banned?: boolean;
        createdAt?: string | Date;
      }>;
    };
    // A user has set their own password once the credential account's password is updated past
    // its creation — which only happens when they complete the emailed reset/set-password flow.
    // Profile/role/ban edits touch the `user` row, not the `account`, so this stays accurate.
    const accounts = await db
      .select({
        userId: schema.account.userId,
        createdAt: schema.account.createdAt,
        updatedAt: schema.account.updatedAt,
      })
      .from(schema.account)
      .where(eq(schema.account.providerId, 'credential'));
    const passwordSet = new Map<string, boolean>();
    for (const a of accounts) {
      const changed =
        a.updatedAt && a.createdAt && a.updatedAt.getTime() - a.createdAt.getTime() > 5000;
      passwordSet.set(a.userId, Boolean(changed));
    }
    // Department/office come from the user's mirrored `host` row (linked by userId).
    const hostRows = await db
      .select({
        userId: schema.host.userId,
        departmentId: schema.host.departmentId,
        departmentName: schema.department.name,
        officeId: schema.host.officeId,
        officeName: schema.office.name,
        isActive: schema.host.isActive,
        availabilityNote: schema.host.availabilityNote,
      })
      .from(schema.host)
      .leftJoin(schema.department, eq(schema.department.id, schema.host.departmentId))
      .leftJoin(schema.office, eq(schema.office.id, schema.host.officeId));
    const assignment = new Map<string, (typeof hostRows)[number]>();
    for (const h of hostRows) if (h.userId) assignment.set(h.userId, h);

    return res.users.map((u) => {
      const a = assignment.get(u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role ?? null,
        banned: Boolean(u.banned),
        passwordSet: passwordSet.get(u.id) ?? false,
        departmentId: a?.departmentId ?? null,
        departmentName: a?.departmentName ?? null,
        officeId: a?.officeId ?? null,
        officeName: a?.officeName ?? null,
        // A user with no host row is treated as active (nothing to hide from booking lists).
        isActive: a?.isActive ?? true,
        availabilityNote: a?.availabilityNote ?? null,
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
      };
    });
  }),
  // Provision an account, then email the user a link to set their own password — the admin
  // never sets or sees a password. A random throwaway secret satisfies better-auth's
  // create-user contract but is immediately superseded by the reset link.
  userCreate: authorized({ user: ['create'] })
    .input(userCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const created = (await auth.api.createUser({
        body: {
          email: input.email,
          password: `${nanoid(24)}aA1!`,
          name: input.name,
          role: input.role,
        },
        headers: headersOf(ctx),
      })) as { user: { id: string } };
      // Mirror into a host row so the user can host visits with their department/office.
      await admin.syncUserHost({
        userId: created.user.id,
        name: input.name,
        email: input.email,
        departmentId: input.departmentId ?? null,
        officeId: input.officeId ?? null,
      });
      await sendPasswordLink(input.email, ctx);
      return created;
    }),
  // Re-send the "set your password" link (e.g. the first email expired or was lost).
  userResend: authorized({ user: ['create'] })
    .input(userResetSchema)
    .mutation(({ input, ctx }) => sendPasswordLink(input.email, ctx)),
  // Edit profile details (name / email / department / office). Role and password changes have
  // their own endpoints. Department/office live on the mirrored host row.
  userUpdate: authorized({ user: ['update'] })
    .input(userUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const updated = await auth.api.adminUpdateUser({
        body: { userId: input.userId, data: { name: input.name, email: input.email } },
        headers: headersOf(ctx),
      });
      await admin.syncUserHost({
        userId: input.userId,
        name: input.name,
        email: input.email,
        departmentId: input.departmentId ?? null,
        officeId: input.officeId ?? null,
      });
      return updated;
    }),
  userSetRole: authorized({ user: ['set-role'] })
    .input(userSetRoleSchema)
    .mutation(({ input, ctx }) =>
      auth.api.setRole({
        body: { userId: input.userId, role: input.role },
        headers: headersOf(ctx),
      }),
    ),
  userBan: authorized({ user: ['ban'] })
    .input(userBanSchema)
    .mutation(({ input, ctx }) =>
      input.banned
        ? auth.api.banUser({ body: { userId: input.userId }, headers: headersOf(ctx) })
        : auth.api.unbanUser({ body: { userId: input.userId }, headers: headersOf(ctx) }),
    ),
  // Mark a staff member active/inactive for booking lists (separate from login ban).
  userSetActive: authorized({ user: ['update'] })
    .input(userSetActiveSchema)
    .mutation(({ input, ctx }) => admin.setUserActive(input, actorFrom(ctx.user))),
});
