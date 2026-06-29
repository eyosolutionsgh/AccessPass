import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, bearer, jwt, organization } from 'better-auth/plugins';
import { and, eq } from 'drizzle-orm';
import { ROLES, ac, roles, schema } from '@vms/shared';
import { db } from './db.ts';
import { env } from './env.ts';
import { getOrganizationName } from './services/admin.ts';
import {
  sendInvitationEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
} from './services/email/auth-emails.ts';

/** How long a "set your password" / reset link stays valid (24h — friendly for invites). */
const RESET_TOKEN_TTL_SECONDS = 60 * 60 * 24;

/**
 * Build the *public* set-password link the recipient clicks. better-auth's own `url` points at the
 * backend endpoint (`${BETTER_AUTH_URL}/api/auth/reset-password/<token>?callbackURL=…`), which would
 * expose the internal API host (e.g. api.vms.3dt.com.gh) in the email. We instead link straight to
 * the web app's reset page with the token — the page POSTs it back to better-auth's resetPassword,
 * so the flow is identical, but the user only ever sees the front-end origin.
 */
const buildResetUrl = (token: string): string =>
  `${env.WEB_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;

/**
 * better-auth fires `sendResetPassword` for two distinct user journeys — the admin-driven
 * invitation (where the credential row was just minted with a throwaway secret) and a
 * forgot-password request from someone who has used the system before. We want each journey
 * to get its own email copy, so we peek at the credential `account` row: until the user
 * completes the emailed link, its `updatedAt` still matches the row's `createdAt`. We allow
 * 5 seconds of slack for clock skew / row-create latency — same heuristic the admin user
 * list uses to show the "password set" badge.
 */
async function userHasSetOwnPassword(userId: string): Promise<boolean> {
  const [credential] = await db
    .select({ createdAt: schema.account.createdAt, updatedAt: schema.account.updatedAt })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, 'credential')));
  if (!credential) return false;
  return credential.updatedAt.getTime() - credential.createdAt.getTime() > 5000;
}

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
    // The same callback backs "forgot password"; we branch on credential state below so the
    // user gets the right copy (invitation vs reset).
    resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
    sendResetPassword: async ({ user, token }) => {
      const [hasPassword, orgName] = await Promise.all([
        userHasSetOwnPassword(user.id),
        getOrganizationName(),
      ]);
      const payload = {
        to: user.email,
        name: user.name,
        url: buildResetUrl(token),
        expiresInHours: RESET_TOKEN_TTL_SECONDS / 3600,
        orgName,
      };
      return hasPassword ? sendPasswordResetEmail(payload) : sendInvitationEmail(payload);
    },
    // Confirmation that a password was just changed — fires after the reset succeeds, so it
    // covers both the invitation set-password flow and forgot-password resets. Failures are
    // swallowed inside the email helper; the password change has already been committed and
    // a confirmation that didn't send shouldn't fail the user-visible response.
    onPasswordReset: async ({ user }) =>
      sendPasswordChangedEmail({
        to: user.email,
        name: user.name,
        orgName: await getOrganizationName(),
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
