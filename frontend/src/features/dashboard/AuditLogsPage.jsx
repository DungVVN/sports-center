import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { DataTableToolbar, SortableHeader } from "../../components/ui/DataTable.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { sortTable } from "../../lib/table.js";
import { dashboardApi } from "./dashboard-api.js";
import "../members/members.css";
import "./audit-logs.css";

const actionLabels = Object.freeze({
  "attendance.checked_in": "Điểm danh vào lớp",
  "attendance.checked_out": "Điểm danh rời lớp",
  "attendance.corrected": "Điều chỉnh điểm danh",
  "auth.login_failed": "Đăng nhập không thành công",
  "auth.login_succeeded": "Đăng nhập thành công",
  "booking.cancelled": "Hủy đặt chỗ",
  "booking.created": "Tạo đặt chỗ",
  "class.change_approved": "Duyệt thay đổi lớp",
  "class.change_rejected": "Từ chối thay đổi lớp",
  "class.change_requested": "Yêu cầu thay đổi lớp",
  "class.created": "Tạo lớp học",
  "class.updated": "Cập nhật lớp học",
  "member.created": "Tạo hội viên",
  "member.registration.approved": "Duyệt tài khoản hội viên",
  "member.registration.created": "Đăng ký hội viên",
  "member.registration.verified": "Xác thực đăng ký",
  "member.updated": "Cập nhật hội viên",
  "membership.created": "Tạo gói cho hội viên",
  "payment.created": "Lập phiếu thu",
  "payment.failed": "Xác nhận thu không thành công",
  "payment.paid": "Xác nhận đã thu tiền mặt",
  "staff.created": "Tạo nhân sự",
  "staff.updated": "Cập nhật nhân sự",
  "training_plan.created": "Tạo giáo án",
  "training_plan.updated": "Cập nhật giáo án",
  "training_result.recorded": "Ghi nhận kết quả tập",
  "training_template.created": "Tạo mẫu giáo án",
});
export function AuditLogsPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditSort, setAuditSort] = useState({ key: "occurred_at", direction: "desc" });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const visibleItems = useMemo(() => {
    const query = auditSearch.trim().toLocaleLowerCase("vi");
    const filtered = items.filter((item) => !query || [actionLabels[item.action], item.summary, item.entity?.label, item.entity?.value, item.actor?.id, item.actor?.name].some((value) => value?.toLocaleLowerCase("vi").includes(query)));
    return sortTable(filtered, auditSort.key, auditSort.direction, (item, key) => key === "action" ? actionLabels[item.action] ?? item.summary : item[key]);
  }, [auditSearch, auditSort, items]);
  function toggleAuditSort(key) {
    setAuditSort((value) => ({ key, direction: value.key === key && value.direction === "asc" ? "desc" : "asc" }));
  }
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await dashboardApi.auditLogs({ page, pageSize: 20 });
      setItems(response.items);
      setPagination(response.pagination);
      setError("");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  return (
    <main className="members-page">
      <header>
        <p>Kiểm toán</p>
        <h1>Nhật ký kiểm toán</h1>
      </header>
      {error && (
        <p className="auth-alert" role="alert">
          {error}
        </p>
      )}
      <section className="members-list">
        <div className="list-heading">
          <h2>Hoạt động gần đây</h2>
          <Button onClick={load} size="sm" variant="ghost">
            Tải lại
          </Button>
        </div>
        {loading ? (
          <p>Đang tải…</p>
        ) : items.length === 0 ? (
          <p>Chưa có nhật ký phù hợp.</p>
        ) : (
          <>
            <DataTableToolbar onClear={() => { setAuditSearch(""); setPage(1); }} resultCount={auditSearch ? visibleItems.length : pagination.total} search={auditSearch} searchPlaceholder="Tìm hoạt động, đối tượng hoặc người thao tác..." setSearch={(value) => { setAuditSearch(value); }} />
            {visibleItems.length === 0 ? <p>Không có nhật ký phù hợp với tìm kiếm.</p> : <div className="table-scroll">
            <table className="audit-log-table">
              <thead>
                <tr>
                  <th>Mã nhật ký</th>
                  <th>Mã người thao tác</th>
                  <th>Người thao tác</th>
                  <SortableHeader activeSort={auditSort.key} column="occurred_at" direction={auditSort.direction} onSort={toggleAuditSort}>Thời điểm</SortableHeader>
                  <th>Nội dung hoạt động</th>
                  <th>Đối tượng tác động</th>
                  <th>Lý do thực hiện</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td className="audit-log-table__identifier"><code>{item.id}</code></td>
                    <td className="audit-log-table__identifier"><code>{item.actor?.id ?? "—"}</code></td>
                    <td>{item.actor?.name ?? "Hệ thống"}</td>
                    <td className="audit-log-table__time">
                      {item.occurred_at
                        ? new Date(item.occurred_at).toLocaleString("vi-VN")
                        : "—"}
                    </td>
                    <td>
                      <div
                        className="audit-log-table__action"
                        title={item.action}
                      >
                        {actionLabels[item.action] ?? item.summary}
                      </div>
                      <small>{item.summary}</small>
                    </td>
                    <td>
                      <div className="audit-log-table__entity">
                        <span>
                          {item.entity?.label ?? "Đối tượng hệ thống"}
                        </span>
                        {item.entity?.value && (
                          <strong>{item.entity.value}</strong>
                        )}
                      </div>
                    </td>
                    <td>{item.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>}
            <Pagination {...pagination} setPage={setPage} />
          </>
        )}
      </section>
    </main>
  );
}
