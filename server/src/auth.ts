import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, bearer, jwt, organization } from 'better-auth/plugins';
import { ROLES, ac, roles, schema } from '@vms/shared';
import { db } from './db.ts';
import { env } from './env.ts';
import { sendPasswordSetupEmail } from './services/email/auth-emails.ts';

/** How long a "set your password" / reset link stays valid (24h — friendly for invites). */
const RESET_TOKEN_TTL_SECONDS = 60 * 60 * 24;

/**
 * better-auth configuration.
 *  - drizzle adapter maps better-auth models → our Drizzle tables (see shared/db/auth.ts)
 *  - admin plugin       → the 7 SRS roles (§3.2) with fine-grained permissions (FR-002)
 *  - organization plugin → per-facility RBAC scoping (NFR-SCL-01, multi-facility)
 *  - jwt + bearer        → tokens for kiosks and the external REST gateway
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  // In development, trust any localhost port so alternate dev/preview servers (e.g. a second Vite
  // instance on another port) can authenticate. Production stays locked to the configured origins.
  trustedOrigins:
    env.NODE_ENV === 'development'
      ? [env.WEB_ORIGIN, env.APP_URL, 'http://localhost:*', 'http://127.0.0.1:*']
      : [env.WEB_ORIGIN, env.APP_URL],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
      jwks: schema.jwks,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Staff accounts are provisioned by an administrator (SRS FR-003), not self-signup.
    disableSignUp: false,
    // New accounts have no admin-set password — the user sets their own via this emailed link.
    // The same flow backs "forgot password" / resend-invite.
    resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
    sendResetPassword: ({ user, url }) =>
      sendPasswordSetupEmail({
        to: user.email,
        name: user.name,
        url,
        expiresInHours: RESET_TOKEN_TTL_SECONDS / 3600,
      }),
  },
  session: {
    expiresIn: 60 * 60 * 8, // 8h — aligns with facility operating hours (SRS NFR-AVL-01)
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [
    admin({
      ac,
      roles,
      defaultRole: ROLES.receptionist,
      adminRoles: [ROLES.admin],
    }),
    organization({ ac, roles }),
    jwt(),
    bearer(),
  ],
});

export type Auth = typeof auth;
