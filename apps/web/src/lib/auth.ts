import { useRef } from 'react';
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

export const { signIn, signOut, useSession, resetPassword, requestPasswordReset, changePassword } =
  authClient;

/**
 * Like {@link useSession}, but `isPending` is only ever true for the FIRST session
 * resolution. better-auth refetches the session whenever the tab regains focus
 * (`refetchOnWindowFocus`, on by default). On screens that render with no session —
 * the sign-in form, the kiosk PostGate — that background refetch flips `isPending`
 * back to `true` (the atom sets `isPending: data === null`). Callers gate their form
 * behind `isPending`, so the flicker unmounts and remounts the form, wiping anything
 * the user had half-typed when they tabbed away and came back. Suppressing the flicker
 * after the first settle keeps the form mounted and its inputs intact.
 */
export function useSettledSession() {
  const result = useSession();
  const settled = useRef(false);
  if (!result.isPending) settled.current = true;
  return { ...result, isPending: result.isPending && !settled.current };
}
