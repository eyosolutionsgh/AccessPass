import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * The life of one async action: resting, in flight, then a terminal state that the UI narrates
 * before returning to `idle`. Consumed by the `AsyncButton` / `AsyncStatusMessage` components so a
 * form gets Save → Saving… → Saved! / Couldn't save, disabled-while-busy, reserved width, and an
 * accessible result out of the box — no per-form `busy` flag.
 */
export type AsyncStatus = 'idle' | 'pending' | 'success' | 'error';

/**
 * Drives one submit action's status machine. `run(action)` flips to `pending`, awaits `action`,
 * then settles on `success` — or on `error` if `action` throws, capturing the thrown `Error`'s
 * message. Both terminal states revert to `idle` after `revertMs` (pass `0` to hold). Throw an
 * `Error` for validation failures too, so they surface through the same path without a network call.
 */
export function useAsyncStatus(revertMs = 2000) {
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A revert scheduled by the last run must not fire after the form unmounts.
  useEffect(() => () => clearTimeout(timer.current), []);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      clearTimeout(timer.current);
      setError(null);
      setStatus('pending');
      try {
        await action();
        setStatus('success');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
        setStatus('error');
      } finally {
        if (revertMs > 0) timer.current = setTimeout(() => setStatus('idle'), revertMs);
      }
    },
    [revertMs],
  );

  return { status, error, run };
}

/** Debounce a rapidly-changing value (e.g. a search box) before it hits the API. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * Client-side search + pagination for an in-memory list (admin config lists that aren't
 * server-paginated). Pass a `match(item, query)` to enable the search box; returns the current
 * page slice plus everything the {@link Pagination} component needs.
 */
export function useClientTable<T>(
  items: T[],
  opts: { query?: string; match?: (item: T, q: string) => boolean; initialPageSize?: number } = {},
) {
  const { query = '', match, initialPageSize = 10 } = opts;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !match) return items;
    return items.filter((it) => match(it, q));
  }, [items, query, match]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Snap back into range when the filter/page-size shrinks the result set.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const current = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => filtered.slice((current - 1) * pageSize, current * pageSize),
    [filtered, current, pageSize],
  );

  return {
    pageItems,
    total,
    page: current,
    pageSize,
    setPage,
    setPageSize: (n: number) => {
      setPageSize(n);
      setPage(1);
    },
  };
}
