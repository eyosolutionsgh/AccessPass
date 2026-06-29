import type { ReactNode } from 'react';
import { cn } from '../../lib/utils.ts';

type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

const sideClass: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  bottom: 'left-1/2 top-full mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
};

export function Tooltip({
  content,
  children,
  side = 'top',
  className,
  tooltipClassName,
}: {
  content?: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
  tooltipClassName?: string;
}) {
  if (!content) return <>{children}</>;

  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 w-max max-w-72 whitespace-normal rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium leading-snug text-white opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100',
          sideClass[side],
          tooltipClassName,
        )}
      >
        {content}
      </span>
    </span>
  );
}
