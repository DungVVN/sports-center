import { Button } from "./Button.jsx";
import "./Pagination.css";

export function Pagination({ page, pageSize, setPage, total, totalPages, disabled = false }) {
  if (total <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const atFirstPage = page === 1;
  const atLastPage = page === totalPages;

  return (
    <nav aria-label="Phân trang" className="pagination">
      <span>Hiển thị {start}–{end} trên {total} bản ghi</span>
      <div className="pagination__controls">
        <Button disabled={disabled || atFirstPage} onClick={() => setPage(1)} size="sm" variant="outline">Đầu</Button>
        <Button disabled={disabled || atFirstPage} onClick={() => setPage((current) => current - 1)} size="sm" variant="outline">Trước</Button>
        <strong>Trang {page} / {totalPages}</strong>
        <Button disabled={disabled || atLastPage} onClick={() => setPage((current) => current + 1)} size="sm" variant="outline">Sau</Button>
        <Button disabled={disabled || atLastPage} onClick={() => setPage(totalPages)} size="sm" variant="outline">Cuối</Button>
      </div>
    </nav>
  );
}
