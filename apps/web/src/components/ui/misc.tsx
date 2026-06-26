import type { LabelHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils.ts';

// Re-export so existing `from '.../ui/misc.tsx'` imports keep resolving.
export { Card } from './card.tsx';
export { StatusBadge } from './badge.tsx';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-xs font-semibold uppercase tracking-wide text-slate-600', className)}
      {...props}
    />
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
