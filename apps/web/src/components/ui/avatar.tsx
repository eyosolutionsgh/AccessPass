import { cn } from '../../lib/utils.ts';

function initials(name: string) {
  const parts = name
    .trim()
    .split(/[\s@.]+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

/** Deterministic gradient avatar from a name/email — no remote images (air-gap safe). */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 select-none items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white shadow-sm ring-1 ring-white/10',
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
