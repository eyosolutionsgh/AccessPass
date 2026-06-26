import { forwardRef, useMemo, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils.ts';
import { COUNTRIES } from '../../lib/countries.ts';
import { trpc } from '../../lib/trpc.ts';
import { CountryFlag } from './country-flag.tsx';

const DEFAULT_COUNTRY = 'GH';

/** ISO-2 → "+233" using the bundled country list. */
function dialFor(iso2: string): { iso2: string; prefix: string } {
  const c = COUNTRIES.find((x) => x.iso2 === iso2);
  return { iso2, prefix: c ? `+${c.dial}` : '' };
}

/**
 * Phone field with a FIXED, non-editable country-code prefix taken from the system-settings
 * country (e.g. 🇬🇭 +233). The user types only the local number; `onChange` receives the full
 * E.164-style string (prefix + digits), or '' when the local part is empty. Digits-only input.
 */
export const PhoneInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
    value: string;
    onChange: (full: string) => void;
  }
>(({ value, onChange, className, disabled, ...props }, ref) => {
  // Public so it also works on the unauthenticated pre-registration page.
  const cfg = trpc.lookups.publicConfig.useQuery();
  const { iso2, prefix } = useMemo(
    () => dialFor(cfg.data?.country ?? DEFAULT_COUNTRY),
    [cfg.data?.country],
  );

  // Show only the local part; the prefix lives in the read-only chip.
  const local = value && prefix && value.startsWith(prefix) ? value.slice(prefix.length) : value || '';

  return (
    <div
      className={cn(
        'flex h-10 w-full items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xs transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span
        className="flex select-none items-center gap-1.5 border-r border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600"
        aria-hidden
      >
        <CountryFlag iso2={iso2} />
        {prefix || '+—'}
      </span>
      <input
        ref={ref}
        type="tel"
        inputMode="numeric"
        disabled={disabled}
        value={local}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          onChange(digits ? `${prefix}${digits}` : '');
        }}
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed"
        {...props}
      />
    </div>
  );
});
PhoneInput.displayName = 'PhoneInput';
