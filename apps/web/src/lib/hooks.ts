import { useEffect, useMemo, useState } from 'react';

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
