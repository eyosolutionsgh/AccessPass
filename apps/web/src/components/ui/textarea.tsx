import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils.ts';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition-colors placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
