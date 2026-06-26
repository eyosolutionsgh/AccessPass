import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'py-10' : 'py-16'}`}
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-8 ring-slate-50">
        <Icon className="size-7" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
