import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils.ts';

const base =
  'flex h-10 w-full rounded-lg border border-slate-300 bg-white text-sm text-slate-900 shadow-xs transition-colors placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(base, 'px-3 py-2', className)} {...props} />
  ),
);
Input.displayName = 'Input';

/** Input with a leading icon (used for search / filter fields). */
export const InputWithIcon = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { icon: ReactNode; wrapperClassName?: string }
>(({ className, icon, wrapperClassName, ...props }, ref) => (
  <div className={cn('relative', wrapperClassName)}>
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 [&_svg]:size-4">
      {icon}
    </span>
    <input ref={ref} className={cn(base, 'pl-9 pr-3 py-2', className)} {...props} />
  </div>
));
InputWithIcon.displayName = 'InputWithIcon';
