import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client.js";
import { errorMessageFor } from "../api/error-message.js";
import { Button } from "./Button.jsx";
import { recordDate } from "../lib/record-date.js";

export function RecordHistory({ entityType, entityId }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["record-history", entityType, entityId, page],
    queryFn: () => apiClient.get(`/audit-logs?${new URLSearchParams({ entityType, entityId, page, pageSize: 20 })}`),
  });
  const pagination = query.data?.pagination;
  return (
    <section className="record-details__history">
      <h3>Lịch sử thao tác</h3>
      {query.isLoading && <p role="status">Đang tải lịch sử…</p>}
      {query.isError && <><p role="alert">{errorMessageFor(query.error, "Không thể tải lịch sử.")}</p><Button onClick={() => query.refetch()} size="sm" variant="secondary">Thử lại</Button></>}
      {query.data?.items.length === 0 && <p>Chưa có nhật ký cho bản ghi này.</p>}
      {query.data?.items.map((event) => <article key={event.id}><strong>{event.summary || event.action}</strong><span>{event.actor?.name ?? "Hệ thống"} · {recordDate(event.occurred_at)}</span>{event.reason && <p>{event.reason}</p>}</article>)}
      {pagination?.totalPages > 1 && <div className="dialog__actions"><Button disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)} size="sm" variant="secondary">Trước</Button><span>Trang {pagination.page}/{pagination.totalPages}</span><Button disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)} size="sm" variant="secondary">Sau</Button></div>}
    </section>
  );
}
