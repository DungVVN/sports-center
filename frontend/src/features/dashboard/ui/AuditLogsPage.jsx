import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../../shared/ui/Button.jsx";
import { DataTableToolbar, SortableHeader } from "../../../shared/ui/DataTable.jsx";
import { Pagination } from "../../../shared/ui/Pagination.jsx";
import { sortTable } from "../../../shared/lib/table.js";
import { dashboardApi } from "../api/dashboard-api.js";
import { TableSkeleton } from "../../../shared/ui/TableSkeleton.jsx";
import { errorMessageFor } from "../../../shared/api/error-message.js";
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
const emptyItems = [];
export function AuditLogsPage() {
  const [auditSearch, setAuditSearch] = useState("");
  const [auditSort, setAuditSort] = useState({ key: "occurred_at", direction: "desc" });
  const [page, setPage] = useState(1);
  const auditQuery = useQuery({ queryKey: ["audit-logs", page, 20], queryFn: () => dashboardApi.auditLogs({ page, pageSize: 20 }) });
  const items = auditQuery.data?.items ?? emptyItems;
  const pagination = auditQuery.data?.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 };
  const visibleItems = useMemo(() => {
    const query = auditSearch.trim().toLocaleLowerCase("vi");
    const filtered = items.filter((item) => !query || [actionLabels[item.action], item.summary, item.entity?.label, item.entity?.value, item.actor?.id, item.actor?.name].some((value) => value?.toLocaleLowerCase("vi").includes(query)));
    return sortTable(filtered, auditSort.key, auditSort.direction, (item, key) => key === "action" ? actionLabels[item.action] ?? item.summary : item[key]);
  }, [auditSearch, auditSort, items]);
  function toggleAuditSort(key) {
    setAuditSort((value) => ({ key, direction: value.key === key && value.direction === "asc" ? "desc" : "asc" }));
  }
  return (
    <main className="members-page">
      <header>
        <p>Nhật kí hoạt động</p>
        <h1>Nhật kí hoạt động</h1>
      </header>
      {auditQuery.isError && (
        <p className="auth-alert" role="alert">
          {errorMessageFor(auditQuery.error, "Không thể tải nhật kí hoạt động.")}
        </p>
      )}
      <section className="members-list">
        <div className="list-heading">
          <h2>Hoạt động gần đây</h2>
          <Button onClick={auditQuery.refetch} size="sm" variant="ghost">
            Tải lại
          </Button>
        </div>
        {auditQuery.isLoading ? (
          <TableSkeleton columns={4} />
        ) : items.length === 0 ? (
          <p>Chưa có nhật ký phù hợp.</p>
        ) : (
          <>
            <DataTableToolbar onClear={() => { setAuditSearch(""); setPage(1); }} resultCount={auditSearch ? visibleItems.length : pagination.total} search={auditSearch} searchPlaceholder="Tìm trong trang hiện tại..." setSearch={setAuditSearch} />
            <p className="audit-log-search-note">Tìm kiếm chỉ áp dụng cho tối đa {pagination.pageSize} nhật ký trên trang hiện tại. Chuyển trang để xem các nhật ký khác.</p>
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
