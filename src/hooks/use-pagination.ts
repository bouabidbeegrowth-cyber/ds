import { useMemo, useState, useEffect } from 'react';

/**
 * Client-side pagination over an already-fetched/filtered array.
 * Resets to page 1 whenever the source array's length changes (e.g. after a
 * new search/filter), so users don't get stuck on an out-of-range page.
 */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setPage(1);
  }, [totalItems]);

  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    page: safePage,
    setPage,
    totalPages,
    totalItems,
    pageSize,
    pageItems,
  };
}
