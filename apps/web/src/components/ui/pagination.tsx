import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { NativeSelect } from './select.tsx';

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

/** Compact list of page numbers with ellipses, e.g. 1 … 4 [5] 6 … 20. */
function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  label = 'results',
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** When provided, shows a "per page" dropdown. */
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  label?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col items-center justify-between gap-3 px-1 py-1 sm:flex-row">
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-500">
          {total === 0 ? (
            <>No {label}</>
          ) : (
            <>
              Showing <span className="font-semibold text-slate-700 nums">{from}</span>–
              <span className="font-semibold text-slate-700 nums">{to}</span> of{' '}
              <span className="font-semibold text-slate-700 nums">{total}</span> {label}
            </>
          )}
        </p>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="hidden sm:inline">Per page</span>
            <NativeSelect
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 w-auto pl-2.5 pr-7 text-xs"
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
      </div>

      {pageCount > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white pl-1.5 pr-2.5 text-xs font-medium text-slate-600 shadow-xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" /> Prev
          </button>

          {pageList(page, pageCount).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-slate-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  'inline-flex size-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors nums',
                  p === page
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-50',
                )}
              >
                {p}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white pl-2.5 pr-1.5 text-xs font-medium text-slate-600 shadow-xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            Next <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
