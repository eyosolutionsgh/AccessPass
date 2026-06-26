import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils.ts';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.02]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 [&_svg]:size-4.5">
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}
