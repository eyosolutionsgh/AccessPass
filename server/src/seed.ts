/**
 * Idempotent dev/demo seed: an administrator account plus minimal reference data
 * (facility, department, visitor categories, a host) so the portal and API are usable.
 * Run with: pnpm --filter @vms/server seed
 */
import { eq } from 'drizzle-orm';
import { ROLES, schema } from '@vms/shared';
import { auth } from './auth.ts';
import { db } from './db.ts';
import { logger } from './logger.ts';

const ADMIN_EMAIL = 'aaodoom@gmail.com';
const ADMIN_PASSWORD = 'Admin123!';

async function seed() {
  // 1. Administrator account
  const [existingAdmin] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, ADMIN_EMAIL));

  let adminId: string;
  if (existingAdmin) {
    adminId = existingAdmin.id;
    logger.info('admin already exists');
  } else {
    const res = (await auth.api.createUser({
      body: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        name: 'System Administrator',
        role: ROLES.admin,
      },
    })) as { user: { id: string } };
    adminId = res.user.id;
    logger.info(`created admin ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  }

  // 2. Facility (code is unique)
  await db
    .insert(schema.facility)
    .values({
      name: 'Headquarters',
      code: 'HQ',
      address: '1 Independence Avenue',
      timezone: 'Africa/Accra',
    })
    .onConflictDoNothing();
  const [facility] = await db.select().from(schema.facility).where(eq(schema.facility.code, 'HQ'));
  if (!facility) throw new Error('facility seed failed');

  // 3. Department
  const [dept] = await db
    .select()
    .from(schema.department)
    .where(eq(schema.department.name, 'Operations'));
  const departmentId =
    dept?.id ??
    (
      await db
        .insert(schema.department)
        .values({ name: 'Operations', facilityId: facility.id })
        .returning()
    )[0]!.id;

  // 4. Visitor categories (upserted so policy flags stay in sync)
  for (const cat of [
    { name: 'Guest', code: 'GUEST', requiresApproval: false },
    {
      name: 'Contractor',
      code: 'CONTRACTOR',
      requiresApproval: true,
      requiresEscort: true,
      requiresInduction: true,
    },
  ]) {
    const [existing] = await db
      .select()
      .from(schema.visitorCategory)
      .where(eq(schema.visitorCategory.code, cat.code));
    if (existing) {
      await db
        .update(schema.visitorCategory)
        .set(cat)
        .where(eq(schema.visitorCategory.id, existing.id));
    } else {
      await db.insert(schema.visitorCategory).values(cat);
    }
  }

  // 5. Host (linked to the admin login)
  const [existingHost] = await db
    .select()
    .from(schema.host)
    .where(eq(schema.host.email, ADMIN_EMAIL));
  if (!existingHost) {
    await db.insert(schema.host).values({
      userId: adminId,
      name: 'System Administrator',
      email: ADMIN_EMAIL,
      departmentId,
      facilityId: facility.id,
    });
  }

  logger.info('✅ seed complete');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'seed failed');
    process.exit(1);
  });
