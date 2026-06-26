import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils.ts';

type Tone = 'brand' | 'emerald' | 'amber' | 'red' | 'cyan' | 'slate';

const TONES: Record<Tone, { icon: string; glow: string; accent: string }> = {
  brand: {
    icon: 'bg-brand-50 text-brand-600',
    glow: 'from-brand-500/10',
    accent: 'text-brand-600',
  },
  emerald: {
    icon: 'bg-emerald-50 text-emerald-600',
    glow: 'from-emerald-500/10',
    accent: 'text-emerald-600',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-600',
    glow: 'from-amber-500/10',
    accent: 'text-amber-600',
  },
  red: { icon: 'bg-red-50 text-red-600', glow: 'from-red-500/10', accent: 'text-red-600' },
  cyan: { icon: 'bg-cyan-50 text-cyan-600', glow: 'from-cyan-500/10', accent: 'text-cyan-600' },
  slate: {
    icon: 'bg-slate-100 text-slate-600',
    glow: 'from-slate-500/5',
    accent: 'text-slate-600',
  },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  hint,
  loading,
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: string;
  loading?: boolean;
}) {
  const t = TONES[tone];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.02] transition-shadow hover:shadow-md">
      <div
        className={cn(
          'pointer-events-none absolute -right-6 -top-10 size-28 rounded-full bg-gradient-to-b to-transparent blur-2xl',
          t.glow,
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          {loading ? (
            <div className="mt-2 h-8 w-12 animate-pulse rounded-md bg-slate-100" />
          ) : (
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 nums">{value}</p>
          )}
          {hint && <p className={cn('mt-1 text-xs font-medium', t.accent)}>{hint}</p>}
        </div>
        {Icon && (
          <span className={cn('flex size-10 items-center justify-center rounded-xl', t.icon)}>
            <Icon className="size-5" />
          </span>
        )}
      </div>
    </div>
  );
}
