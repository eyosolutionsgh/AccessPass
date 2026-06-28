import { useEffect } from 'react';
import { applyBrandTheme } from '../lib/theme.ts';
import { trpc } from '../lib/trpc.ts';

/**
 * Applies the admin-configured brand colour app-wide. Reads the public config (so it themes the
 * sign-in and kiosk screens too) and only applies once the query resolves — until then the
 * synchronously-applied cached colour (see main.tsx) stays, avoiding a flash of the default palette.
 * Renders nothing.
 */
export function BrandThemeSync() {
  const cfg = trpc.lookups.publicConfig.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const brandColor = cfg.data?.brandColor ?? null;
  const loaded = cfg.isSuccess;
  useEffect(() => {
    if (loaded) applyBrandTheme(brandColor);
  }, [loaded, brandColor]);
  return null;
}
