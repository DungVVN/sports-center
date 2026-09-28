import { Button } from "../../../components/ui/Button.jsx";
import { DataTableToolbar, FilterMenu } from "../../../components/ui/DataTable.jsx";
import { Pagination } from "../../../components/ui/Pagination.jsx";
import { TableSkeleton } from "../../../components/ui/TableSkeleton.jsx";

const labels = { pending_payment: "Chờ thanh toán", active: "Đang hoạt động", expiring_soon: "Sắp hết hạn", expired: "Đã hết hạn", frozen: "Đang đóng băng", cancelled: "Đã hủy" };

export function MembersTable({ filters, loading, members, onClearFilters, onEdit, onFilterToggle, onIssueAccountCredentials, onOpenAssignment, onReload, onSearchChange, onToggleFilterValue, pagination, readOnly, visibleMembers }) {
  const { coach, isOpen, package: packageFilters, search, status } = filters;
  const coachOptions = [...new Set(members.map((member) => member.coachName ?? "__unassigned"))].sort((a, b) => a.localeCompare(b, "vi-VN"));
  const packageOptions = [...new Set(members.map((member) => member.registeredPackageName ?? "__unregistered"))].sort((a, b) => a.localeCompare(b, "vi-VN"));
  const statusOptions = [...new Set(members.map((member) => member.membershipStatus ?? "__no_membership"))];
  return <section className="members-list">
    <div className="list-heading"><h2>Danh sách hội viên</h2><Button onClick={onReload} size="sm" variant="ghost">Tải lại</Button></div>
    {loading ? <TableSkeleton columns={7} /> : members.length === 0 ? <p>Chưa có hội viên.</p> : <>
      <DataTableToolbar onClear={onClearFilters} resultCount={visibleMembers.length} search={search} searchPlaceholder="Tìm tên, mã, email..." setSearch={onSearchChange}>
        <FilterMenu activeCount={coach.length + packageFilters.length + status.length} isOpen={isOpen} onToggle={onFilterToggle}>
          {[["Coach phụ trách", coachOptions, coach, "coach"], ["Gói đăng ký", packageOptions, packageFilters, "package"], ["Tình trạng gói", statusOptions, status, "status"]].map(([title, options, selected, kind]) => <fieldset className="payment-filter-group" key={kind}><legend>{title}</legend>{options.map((value) => <label key={value}><input checked={selected.includes(value)} onChange={() => onToggleFilterValue(kind, value)} type="checkbox" />{value === "__unassigned" ? "Chưa phân công" : value === "__unregistered" ? "Chưa đăng ký" : value === "__no_membership" ? "Chưa có gói" : labels[value] ?? value}</label>)}</fieldset>)}
        </FilterMenu>
      </DataTableToolbar>
      {visibleMembers.length === 0 ? <p>Không tìm thấy hội viên phù hợp.</p> : <div className="table-scroll"><table><thead><tr><th>Mã hội viên</th><th>Hội viên</th><th>Thông tin liên hệ</th><th>Gói đăng ký</th><th>Tình trạng gói</th><th>Ngày đăng ký</th><th>Coach phụ trách</th>{!readOnly && <th>Thao tác</th>}</tr></thead><tbody>
        {pagination.pageItems.map((item) => <tr key={item.id}><td><code>{item.memberCode}</code></td><td><strong>{item.fullName}</strong><small>{item.email ?? "Chưa có email"}</small></td><td>{item.phone}</td><td>{item.registeredPackageName ? <><strong>{item.registeredPackageName}</strong>{item.membershipExpiresOn && <small>Hết hạn {new Date(item.membershipExpiresOn).toLocaleDateString("vi-VN")}</small>}</> : "Chưa đăng ký"}</td><td>{item.membershipStatus ? labels[item.membershipStatus] ?? item.membershipStatus : "Chưa có gói"}</td><td>{item.joinedAt ? new Date(item.joinedAt).toLocaleDateString("vi-VN") : "—"}</td><td>{item.coachName ?? "Chưa phân công"}</td>{!readOnly && <td><div className="member-row-actions"><Button disabled={!item.email} onClick={() => onIssueAccountCredentials(item)} size="sm" variant="outline">{item.hasAccount ? "Gửi lại MK" : "Tạo tài khoản"}</Button><Button onClick={() => onEdit(item)} size="sm">Sửa</Button><Button onClick={() => onOpenAssignment(item)} size="sm" variant="outline">Coach</Button></div></td>}</tr>)}
      </tbody></table></div>}
      <Pagination {...pagination} />
    </>}
  </section>;
}
