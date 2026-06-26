import type { HTMLAttributes, ReactNode, ThHTMLAttributes } from 'react';
import { cn } from '../../lib/utils.ts';

/** Scroll container + base table styling shared by every data table. */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...props} />
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </thead>
  );
}

export function Th({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn('px-4 py-3 font-semibold', className)} {...props}>
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

/** A full-width row used for loading / empty / error states inside a table. */
export function StateRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12">
        {children}
      </td>
    </tr>
  );
}

/** Shimmering skeleton rows while a query is loading. */
export function SkeletonRows({ rows = 5, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3.5">
              <div
                className="h-3.5 animate-pulse rounded-full bg-slate-100"
                style={{ width: `${c === 0 ? 70 : 40 + ((r + c) % 3) * 12}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
