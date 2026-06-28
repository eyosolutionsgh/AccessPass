import { useLogoSrc } from '../lib/branding.ts';
import { cn } from '../lib/utils.ts';

/**
 * App logo — the institution emblem on a white chip so it stays legible on both the dark sidebar
 * and the light auth/kiosk screens. Pass sizing + rounding via `className` (e.g. "size-8 rounded-lg").
 * The source resolves to the admin-uploaded logo when one exists, else the bundled default
 * (Ghana coat of arms); both are served same-origin (air-gap safe).
 */
export function Logo({ className }: { className?: string }) {
  const src = useLogoSrc();
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-black/5',
        className,
      )}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="size-[82%] object-contain"
      />
    </span>
  );
}
