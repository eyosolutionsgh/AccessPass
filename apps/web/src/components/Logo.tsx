import { cn } from '../lib/utils.ts';

/**
 * App logo — the institution emblem (Ghana coat of arms) on a white chip so it stays legible on
 * both the dark sidebar and the light auth screens. Pass sizing + rounding via `className`
 * (e.g. "size-8 rounded-lg"). The SVG is served same-origin from /public (air-gap safe).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-black/5',
        className,
      )}
    >
      <img
        src="/brand/ghana-coat-of-arms.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="size-[82%] object-contain"
      />
    </span>
  );
}
