import { Button } from "../../../components/ui/Button.jsx";
import { DataTableToolbar, FilterMenu } from "../../../components/ui/DataTable.jsx";
import { Pagination } from "../../../components/ui/Pagination.jsx";
import { TableSkeleton } from "../../../components/ui/TableSkeleton.jsx";

const labels = { pending_payment: "Chờ thanh toán", active: "Đang hoạt động", expiring_soon: "Sắp hết hạn", expired: "Đã hết hạn", frozen: "Đang đóng băng", cancelled: "Đã hủy" };

function MemberRowActions({ canResetCredentials, item, onEdit, onIssueAccountCredentials, onOpenAssignment, readOnly }) {
  return <div aria-label={`Thao tác hội viên ${item.fullName}`} className="member-row-actions" role="group">
    {!readOnly && <div className="member-row-actions__main">
      <Button onClick={() => onEdit(item)} size="sm">Sửa</Button>
      <Button onClick={() => onOpenAssignment(item)} size="sm" variant="outline">Coach</Button>
    </div>}
    {canResetCredentials && <Button className="member-row-actions__account" disabled={!item.email} onClick={() => onIssueAccountCredentials(item)} size="sm" variant="ghost">{item.hasAccount ? "Gửi lại MK" : "Tạo tài khoản"}</Button>}
  </div>;
}

export function MembersTable({ canResetCredentials, filters, loading, members, onClearFilters, onEdit, onFilterToggle, onIssueAccountCredentials, onOpenAssignment, onReload, onSearchChange, onToggleFilterValue, pagination, readOnly, visibleMembers }) {
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
      {visibleMembers.length === 0 ? <p>Không tìm thấy hội viên phù hợp.</p> : <div className="table-scroll"><table className="members-list__table"><thead><tr><th scope="col">Mã hội viên</th><th scope="col">Hội viên</th><th scope="col">Liên hệ</th><th scope="col">Gói đăng ký</th><th scope="col">Coach phụ trách</th>{(!readOnly || canResetCredentials) && <th scope="col">Thao tác</th>}</tr></thead><tbody>
        {pagination.pageItems.map((item) => <tr key={item.id}><td><code>{item.memberCode}</code></td><td><strong>{item.fullName}</strong><small>Tham gia: {item.joinedAt ? new Date(item.joinedAt).toLocaleDateString("vi-VN") : "—"}</small></td><td className="members-list__contact"><span>{item.email ?? "Chưa có email"}</span><small>{item.phone ?? "Chưa có số điện thoại"}</small></td><td className="members-list__package"><strong>{item.registeredPackageName ?? "Chưa đăng ký"}</strong><small>{item.membershipStatus ? labels[item.membershipStatus] ?? item.membershipStatus : "Chưa có gói"}{item.membershipExpiresOn && ` · Hết hạn ${new Date(item.membershipExpiresOn).toLocaleDateString("vi-VN")}`}</small></td><td>{item.coachName ?? "Chưa phân công"}</td>{(!readOnly || canResetCredentials) && <td><MemberRowActions canResetCredentials={canResetCredentials} item={item} onEdit={onEdit} onIssueAccountCredentials={onIssueAccountCredentials} onOpenAssignment={onOpenAssignment} readOnly={readOnly} /></td>}</tr>)}
      </tbody></table></div>}
      <Pagination {...pagination} />
    </>}
  </section>;
}
