import type { ReactNode } from 'react';
import type { VisitStatusValue } from '@vms/shared';
import { cn } from '../../lib/utils.ts';

/** Generic pill. */
export function Badge({
  children,
  className,
  tone = 'slate',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'slate' | 'brand' | 'green' | 'amber' | 'red' | 'cyan';
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-600/15',
    brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    red: 'bg-red-50 text-red-700 ring-red-600/20',
    cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Visit-lifecycle status with a colored status dot (SRS FR-012). */
const STATUS_STYLES: Record<string, { cls: string; dot: string }> = {
  draft: { cls: 'bg-slate-100 text-slate-600 ring-slate-500/15', dot: 'bg-slate-400' },
  pending_approval: { cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-500' },
  approved: { cls: 'bg-blue-50 text-blue-700 ring-blue-600/20', dot: 'bg-blue-500' },
  invitation_sent: { cls: 'bg-brand-50 text-brand-700 ring-brand-600/20', dot: 'bg-brand-500' },
  pre_registered: { cls: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20', dot: 'bg-cyan-500' },
  checked_in: {
    cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    dot: 'bg-emerald-500 animate-pulse-ring',
  },
  checked_out: { cls: 'bg-slate-100 text-slate-600 ring-slate-500/15', dot: 'bg-slate-400' },
  cancelled: { cls: 'bg-slate-100 text-slate-500 ring-slate-500/15', dot: 'bg-slate-300' },
  expired: { cls: 'bg-orange-50 text-orange-700 ring-orange-600/20', dot: 'bg-orange-500' },
  denied: { cls: 'bg-red-50 text-red-700 ring-red-600/20', dot: 'bg-red-500' },
  no_show: { cls: 'bg-rose-50 text-rose-700 ring-rose-600/20', dot: 'bg-rose-500' },
};

export function StatusBadge({ status }: { status: VisitStatusValue | string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft!;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset',
        s.cls,
      )}
    >
      <span className={cn('size-1.5 rounded-full', s.dot)} />
      {String(status).replace(/_/g, ' ')}
    </span>
  );
}

const SEV_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 ring-slate-500/15',
  medium: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  high: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  critical: 'bg-red-50 text-red-700 ring-red-600/20',
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset',
        SEV_STYLES[severity] ?? SEV_STYLES.low,
      )}
    >
      {severity}
    </span>
  );
}

const RESULT_STYLES: Record<string, { cls: string; dot: string }> = {
  success: { cls: 'text-emerald-700', dot: 'bg-emerald-500' },
  denied: { cls: 'text-red-700', dot: 'bg-red-500' },
  failure: { cls: 'text-amber-700', dot: 'bg-amber-500' },
};

export function ResultBadge({ result }: { result: string }) {
  const r = RESULT_STYLES[result] ?? RESULT_STYLES.failure!;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium capitalize', r.cls)}>
      <span className={cn('size-1.5 rounded-full', r.dot)} />
      {result}
    </span>
  );
}
