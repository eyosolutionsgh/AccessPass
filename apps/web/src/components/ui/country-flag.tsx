// Local SVG flags (flag-icons, MIT) — bundled, no CDN, and render identically
// on Windows where emoji flags don't. CSS is code-split into whatever chunk
// imports this component.
import 'flag-icons/css/flag-icons.min.css';
import { cn } from '../../lib/utils.ts';

/** A small 4:3 country flag from its ISO-3166 alpha-2 code (e.g. "GH"). */
export function CountryFlag({ iso2, className }: { iso2: string; className?: string }) {
  const code = (iso2 || '').toLowerCase();
  return (
    <span
      className={cn('fi shrink-0 rounded-[3px] ring-1 ring-black/10', `fi-${code}`, className)}
      style={{ width: '1.25rem', height: '0.9375rem' }}
      aria-hidden
    />
  );
}
