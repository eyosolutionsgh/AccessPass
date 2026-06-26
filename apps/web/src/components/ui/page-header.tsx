import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        {Icon && (
          <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-[var(--shadow-brand)]">
            <Icon className="size-5.5" />
          </span>
        )}
        <div>
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
