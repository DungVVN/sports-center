import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "../../components/ui/Button.jsx";
import { DataTableToolbar, FilterMenu, SortableHeader } from "../../components/ui/DataTable.jsx";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { usePagination } from "../../components/ui/usePagination.js";
import { sortTable } from "../../lib/table.js";
import { useStaffWorkspace } from "./hooks/useStaffWorkspace.js";
import "./staff.css";

const empty = {
  fullName: "",
  email: "",
  phone: "",
  role: "receptionist",
  specialties: [],
};

const staffRoleOptions = [
  ["manager", "Quản lý"],
  ["receptionist", "Lễ tân"],
  ["coach", "Huấn luyện viên"],
];

const staffStatusOptions = [
  ["active", "Đang hoạt động"],
  ["suspended", "Đình chỉ"],
];
const staffRoleLabels = Object.fromEntries(staffRoleOptions);
const staffStatusLabels = Object.fromEntries(staffStatusOptions);

export function StaffPage() {
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [password, setPassword] = useState(null);
  const [credentialEmailDelivered, setCredentialEmailDelivered] = useState(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffRoleFilters, setStaffRoleFilters] = useState([]);
  const [staffStatusFilters, setStaffStatusFilters] = useState([]);
  const [isStaffFilterOpen, setIsStaffFilterOpen] = useState(false);
  const [staffSort, setStaffSort] = useState({ key: "fullName", direction: "asc" });
  const workspace = useStaffWorkspace({ editingId });
  const { staff } = workspace;
  const submitting = workspace.createStaff.isPending || workspace.updateStaff.isPending || workspace.updateStatus.isPending || workspace.detailLoading;
  const visibleStaff = useMemo(() => {
    const query = staffSearch.trim().toLocaleLowerCase("vi");
    const filtered = staff.filter((item) =>
      (!staffRoleFilters.length || staffRoleFilters.includes(item.role)) &&
      (!staffStatusFilters.length || staffStatusFilters.includes(item.status)) &&
      (!query || [item.employeeCode, item.fullName, item.email, item.phone].some((value) => value?.toLocaleLowerCase("vi").includes(query))),
    );
    return sortTable(filtered, staffSort.key, staffSort.direction, (item, key) => item[key]);
  }, [staff, staffRoleFilters, staffSearch, staffSort, staffStatusFilters]);
  const staffPagination = usePagination(visibleStaff);

  function toggleFilterValue(setter, value) {
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }
  function toggleStaffSort(key) {
    setStaffSort((value) => ({ key, direction: value.key === key && value.direction === "asc" ? "desc" : "asc" }));
  }
  const update = (event) =>
    setForm((value) => ({ ...value, [event.target.name]: event.target.value }));
  function create(event) {
    event.preventDefault();
    setCredentialEmailDelivered(null);
    workspace.createStaff.mutate(form, { onSuccess: (result) => {
      setPassword(result.temporaryPassword ?? null);
      setCredentialEmailDelivered(result.credentialEmailDelivered === true);
      setForm(empty);
    } });
  }
  function copyPassword() {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  }
  function status(id, value) {
    workspace.updateStatus.mutate({ id, status: value });
  }
  function openEdit(item) {
    setEditingId(item.id);
  }
  function save(input) {
    if (!editingId) return;
    workspace.updateStaff.mutate({ id: editingId, input: { ...input, specialties: input.specialties.filter(Boolean) } }, { onSuccess: () => setEditingId(null) });
  }
  return (
    <main className="staff-page">
      <header>
        <p>Quản trị</p>
        <h1>Quản lý nhân viên</h1>
      </header>
      {workspace.error && (
        <p className="auth-alert" role="alert">
          {workspace.error}
        </p>
      )}
      {password && (
        <section className="staff-password">
          <strong>Mật khẩu tạm thời — chỉ hiển thị lần này</strong>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "8px 0" }}>
            <code>{password}</code>
            <Button onClick={copyPassword} size="sm" type="button" variant="outline">
              {copiedPassword ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copiedPassword ? "Đã sao chép!" : "Sao chép"}
            </Button>
          </div>
          <p>
            {credentialEmailDelivered
              ? "Mật khẩu này không được lưu hoặc hiển thị lại. Hệ thống cũng đã gửi email thông tin đăng nhập cho nhân viên."
              : "Email chưa gửi được hoặc chưa cấu hình SMTP, Quản lý vui lòng gửi riêng thông tin cho nhân viên. Mật khẩu này không được lưu hoặc hiển thị lại."}
          </p>
          <Button onClick={() => setPassword(null)} variant="secondary">
            Đã lưu an toàn
          </Button>
        </section>
      )}
      {credentialEmailDelivered && (
        <p className="auth-success" role="status">
          Đã gửi email chứa tài khoản và mật khẩu tạm thời cho nhân viên.
        </p>
      )}
      <section className="staff-workspace-stacked">
        <form className="staff-form staff-form--create" onSubmit={create}>
          <h2>Thêm nhân viên</h2>
          <label>
            Họ tên
            <input
              name="fullName"
              onChange={update}
              required
              value={form.fullName}
            />
          </label>
          <label>
            Email
            <input
              name="email"
              onChange={update}
              required
              type="email"
              value={form.email}
            />
          </label>
          <label>
            Số điện thoại
            <input name="phone" onChange={update} required value={form.phone} />
          </label>
          <label>
            Vai trò
            <select name="role" onChange={update} value={form.role}>
              <option value="receptionist">Lễ tân</option>
              <option value="coach">Huấn luyện viên</option>
              <option value="manager">Quản lý</option>
            </select>
          </label>
          <Button loading={submitting} type="submit">
            Tạo nhân viên
          </Button>
        </form>
        <section className="staff-list">
          <div className="list-heading"><h2>Danh sách nhân viên</h2><Button onClick={workspace.reload} size="sm" variant="ghost">Tải lại</Button></div>
          {workspace.loading ? (
            <p>Đang tải…</p>
          ) : staff.length === 0 ? (
            <p>Chưa có nhân viên.</p>
          ) : (
            <><DataTableToolbar onClear={() => { setStaffSearch(""); setStaffRoleFilters([]); setStaffStatusFilters([]); }} resultCount={visibleStaff.length} search={staffSearch} searchPlaceholder="Tìm mã, tên, email, số điện thoại..." setSearch={setStaffSearch}>
              <FilterMenu activeCount={staffRoleFilters.length + staffStatusFilters.length} isOpen={isStaffFilterOpen} onToggle={() => setIsStaffFilterOpen((value) => !value)}>
                <fieldset className="payment-filter-group">
                  <legend>Vai trò</legend>
                  {staffRoleOptions.map(([value, label]) => (
                    <label key={value}>
                      <input checked={staffRoleFilters.includes(value)} onChange={() => toggleFilterValue(setStaffRoleFilters, value)} type="checkbox" />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <fieldset className="payment-filter-group">
                  <legend>Trạng thái</legend>
                  {staffStatusOptions.map(([value, label]) => (
                    <label key={value}>
                      <input checked={staffStatusFilters.includes(value)} onChange={() => toggleFilterValue(setStaffStatusFilters, value)} type="checkbox" />
                      {label}
                    </label>
                  ))}
                </fieldset>
              </FilterMenu>
            </DataTableToolbar>{visibleStaff.length === 0 ? <p>Không có nhân viên phù hợp với bộ lọc.</p> : <div className="table-scroll"><table>
              <thead>
                <tr>
                  <SortableHeader activeSort={staffSort.key} column="employeeCode" direction={staffSort.direction} onSort={toggleStaffSort}>Mã nhân viên</SortableHeader>
                  <SortableHeader activeSort={staffSort.key} column="fullName" direction={staffSort.direction} onSort={toggleStaffSort}>Nhân viên</SortableHeader>
                  <SortableHeader activeSort={staffSort.key} column="email" direction={staffSort.direction} onSort={toggleStaffSort}>Email</SortableHeader>
                  <SortableHeader activeSort={staffSort.key} column="phone" direction={staffSort.direction} onSort={toggleStaffSort}>Số điện thoại</SortableHeader>
                  <SortableHeader activeSort={staffSort.key} column="role" direction={staffSort.direction} onSort={toggleStaffSort}>Vai trò</SortableHeader>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {staffPagination.pageItems.map((item) => (
                  <tr key={item.id}>
                    <td><code>{item.employeeCode ?? "—"}</code></td>
                    <td>
                      <strong>{item.fullName}</strong>
                    </td>
                    <td>{item.email}</td>
                    <td>{item.phone ?? "—"}</td>
                    <td>
                      <span className={`staff-role staff-role--${item.role}`}>
                        {staffRoleLabels[item.role] ?? item.role}
                      </span>
                    </td>
                    <td>
                      <span className={`staff-status staff-status--${item.status}`}>
                        {staffStatusLabels[item.status] ?? item.status}
                      </span>
                    </td>
                    <td>
                      <Button
                        disabled={submitting}
                        onClick={() => openEdit(item)}
                        size="sm"
                        variant="primary"
                      >
                        Sửa
                      </Button>{" "}
                      <Button
                        disabled={submitting}
                        onClick={() =>
                          status(
                            item.id,
                            item.status === "active" ? "suspended" : "active",
                          )
                        }
                        size="sm"
                        variant={
                          item.status === "active" ? "danger" : "secondary"
                        }
                      >
                        {item.status === "active" ? "Đình chỉ" : "Kích hoạt"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>}
            <Pagination {...staffPagination} />
            </>
          )}
        </section>
      </section>
      <StaffEditDialog detail={workspace.detail} editingId={editingId} loading={workspace.detailLoading} onClose={() => setEditingId(null)} onSubmit={save} />
    </main>
  );
}

function StaffEditDialog({ detail, editingId, loading, onClose, onSubmit }) {
  if (!editingId) return null;
  const close = () => { if (!loading) onClose(); };
  return <Dialog isOpen onClose={close} title="Cập nhật nhân viên">{loading && !detail ? <p className="dialog__body">Đang tải hồ sơ…</p> : detail && <StaffEditForm detail={detail} loading={loading} onClose={close} onSubmit={onSubmit} />}</Dialog>;
}

function StaffEditForm({ detail, loading, onClose, onSubmit }) {
  const [form, setForm] = useState({ fullName: detail.fullName, email: detail.email, phone: detail.phone ?? "", role: detail.role, specialties: detail.specialties ?? [] });
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}><div className="dialog__body"><label>Họ tên<input disabled={loading} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} required value={form.fullName} /></label><label>Email<input disabled type="email" value={form.email} /></label><label>Số điện thoại<input disabled={loading} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required value={form.phone} /></label><label>Vai trò<select disabled={loading} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} value={form.role}><option value="receptionist">Lễ tân</option><option value="coach">Huấn luyện viên</option><option value="manager">Quản lý</option></select></label><label>Chuyên môn (cách nhau bởi dấu phẩy)<input disabled={loading} onChange={(event) => setForm((current) => ({ ...current, specialties: event.target.value.split(",").map((value) => value.trim()) }))} value={form.specialties.join(", ")} /></label></div><div className="dialog__actions"><Button disabled={loading} onClick={onClose} type="button" variant="secondary">Hủy</Button><Button loading={loading} type="submit">Lưu thay đổi</Button></div></form>;
}
