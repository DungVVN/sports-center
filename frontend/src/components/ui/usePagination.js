import { useMemo, useState } from "react";

export function usePagination(items, pageSize = 10) {
  const [requestedPage, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return { page, pageItems, pageSize, setPage, total, totalPages };
}
