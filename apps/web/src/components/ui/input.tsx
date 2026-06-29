import { Eye, EyeOff, Lock } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, type ReactNode, useState } from 'react';
import { cn } from '../../lib/utils.ts';
import { Tooltip } from './tooltip.tsx';

const base =
  'flex h-10 w-full rounded-lg border border-slate-300 bg-white text-sm text-slate-900 shadow-xs transition-colors placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, title, placeholder, ...props }, ref) => (
    <input
      ref={ref}
      title={title ?? (typeof placeholder === 'string' ? placeholder : undefined)}
      placeholder={placeholder}
      className={cn(base, 'px-3 py-2', className)}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

/** Input with a leading icon (used for search / filter fields). */
export const InputWithIcon = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    icon: ReactNode;
    wrapperClassName?: string;
    tooltip?: ReactNode;
  }
>(({ className, icon, wrapperClassName, tooltip, ...props }, ref) => {
  const tooltipContent =
    tooltip ??
    (typeof props.title === 'string'
      ? props.title
      : typeof props['aria-label'] === 'string'
        ? props['aria-label']
        : typeof props.placeholder === 'string'
          ? props.placeholder
          : undefined);

  return (
    <Tooltip content={tooltipContent} className={cn('w-full', wrapperClassName)}>
      <div className="relative w-full">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 [&_svg]:size-4">
          {icon}
        </span>
        <input ref={ref} className={cn(base, 'pl-9 pr-3 py-2', className)} {...props} />
      </div>
    </Tooltip>
  );
});
InputWithIcon.displayName = 'InputWithIcon';

/**
 * Password field with a leading lock icon and a trailing show/hide toggle. Drop-in replacement
 * for `<InputWithIcon icon={<Lock />} type="password" />` — manages its own visibility state.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { wrapperClassName?: string }
>(({ className, wrapperClassName, ...props }, ref) => {
  const [show, setShow] = useState(false);
  return (
    <div className={cn('relative w-full', wrapperClassName)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 [&_svg]:size-4">
        <Lock />
      </span>
      <input
        ref={ref}
        type={show ? 'text' : 'password'}
        className={cn(base, 'pl-9 pr-10 py-2', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        title={show ? 'Hide password' : 'Show password'}
        className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md p-1.5 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 [&_svg]:size-4"
      >
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';
