import { apiBase } from './api.ts';
import { trpc } from './trpc.ts';

/** Shown when an administrator hasn't set the institution name yet (staff-facing screens). */
export const APP_NAME_FALLBACK = 'Visitor Management System';

/** Bundled fallback emblem (Ghana coat of arms) shown until/unless a logo is uploaded. */
export const DEFAULT_LOGO_SRC = '/brand/ghana-coat-of-arms.svg';

/** Public, unauthenticated branding config — works on the sign-in and kiosk screens too. */
export function usePublicConfig() {
  return trpc.lookups.publicConfig.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
}

/**
 * The configured institution name (Admin → Settings → Organization name), used on the auth pages,
 * the sidebar and the document title. Falls back to a generic label until an admin sets it.
 */
export function useOrgName(): string {
  const cfg = usePublicConfig();
  return cfg.data?.organizationName?.trim() || APP_NAME_FALLBACK;
}

/**
 * Resolved logo source: the uploaded institution logo (served, versioned, from the API) when one
 * exists, otherwise the bundled default. So a fresh deploy shows the default and an upload
 * overrides it everywhere `<Logo>` is rendered — no per-call wiring needed.
 */
export function useLogoSrc(): string {
  const cfg = usePublicConfig();
  const v = cfg.data?.logoVersion;
  return v ? `${apiBase}/api/v1/branding/logo?v=${v}` : DEFAULT_LOGO_SRC;
}

/** Whether a custom institution logo is in use (vs. the bundled default). */
export function useHasCustomLogo(): boolean {
  return usePublicConfig().data?.logoVersion != null;
}

/** The configured brand seed colour (hex), or null when using the built-in palette. */
export function useBrandColor(): string | null {
  return usePublicConfig().data?.brandColor ?? null;
}
