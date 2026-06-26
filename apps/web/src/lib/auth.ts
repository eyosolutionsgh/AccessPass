import { createAuthClient } from 'better-auth/react';
import { adminClient, organizationClient } from 'better-auth/client/plugins';
import { ac, roles } from '@vms/shared';
import { apiBase } from './api.ts';

/**
 * better-auth client. Shares the SAME access-control + roles as the server so permission
 * checks in the UI match server enforcement exactly (SRS FR-002).
 *
 * `baseURL` is empty (same-origin) in dev; in production it points at the API host
 * (api.vms.3dt.com.gh). `credentials: 'include'` ensures the session cookie is sent on the
 * cross-origin (same-site) auth requests.
 */
export const authClient = createAuthClient({
  baseURL: apiBase || undefined,
  fetchOptions: { credentials: 'include' },
  plugins: [adminClient({ ac, roles }), organizationClient({ ac, roles })],
});

export const { signIn, signOut, useSession, resetPassword, requestPasswordReset } = authClient;
