import { trpc } from './trpc.ts';

/** Shown when an administrator hasn't set the institution name yet (staff-facing screens). */
export const APP_NAME_FALLBACK = 'Visitor Management System';

/**
 * The configured institution name (Admin → Settings → Organization name), used on the auth pages,
 * the sidebar and the document title. Falls back to a generic label until an admin sets it.
 * Reads the public, unauthenticated config so it works on the sign-in screen too.
 */
export function useOrgName(): string {
  const cfg = trpc.lookups.publicConfig.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  return cfg.data?.organizationName?.trim() || APP_NAME_FALLBACK;
}
