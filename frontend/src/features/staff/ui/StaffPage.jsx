import { useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "../../../shared/ui/Button.jsx";
import { DataTableToolbar, FilterMenu, SortableHeader } from "../../../shared/ui/DataTable.jsx";
import { Dialog } from "../../../shared/ui/Dialog.jsx";
import { Pagination } from "../../../shared/ui/Pagination.jsx";
import { usePagination } from "../../../shared/ui/usePagination.js";
import { sortTable } from "../../../shared/lib/table.js";
import { useStaffWorkspace } from "../api/useStaffWorkspace.js";
import { TableSkeleton } from "../../../shared/ui/TableSkeleton.jsx";
import { useToast } from "../../../shared/ui/useToast.js";
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
const phoneLengthError = "Số điện thoại phải từ 9 đến 20 ký tự.";
const hasValidPhoneLength = (phone) => {
  const length = phone.trim().length;
  return length >= 9 && length <= 20;
};

export function StaffPage({ session }) {
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [password, setPassword] = useState(null);
  const [credentialEmailDelivered, setCredentialEmailDelivered] = useState(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [validationError, setValidationError] = useState("");
  const phoneInputRef = useRef(null);
  const showToast = useToast();
  const [staffSearch, setStaffSearch] = useState("");
  const [staffRoleFilters, setStaffRoleFilters] = useState([]);
  const [staffStatusFilters, setStaffStatusFilters] = useState([]);
  const [isStaffFilterOpen, setIsStaffFilterOpen] = useState(false);
  const [staffSort, setStaffSort] = useState({ key: "fullName", direction: "asc" });
  const workspace = useStaffWorkspace({ editingId });
  const { staff } = workspace;
  const submitting = workspace.createStaff.isPending || workspace.updateStaff.isPending || workspace.updateStatus.isPending || workspace.resetPassword.isPending || workspace.detailLoading;
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
  const update = (event) => {
    setValidationError("");
    workspace.clearFeedback();
    setForm((value) => ({ ...value, [event.target.name]: event.target.value }));
  };
  function create(event) {
    event.preventDefault();
    if (!hasValidPhoneLength(form.phone)) {
      workspace.clearFeedback();
      setValidationError(phoneLengthError);
      phoneInputRef.current?.focus();
      return;
    }
    setCredentialEmailDelivered(null);
    workspace.createStaff.mutate(form, { onSuccess: (result) => {
      setPassword(result.temporaryPassword ?? null);
      setCredentialEmailDelivered(result.credentialEmailDelivered === true);
      setForm(empty);
    } });
  }
  async function copyPassword() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopiedPassword(true);
      showToast?.("Đã sao chép mật khẩu tạm thời.", "success");
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch {
      showToast?.("Không thể sao chép mật khẩu. Vui lòng chọn và sao chép thủ công từ ô đang hiển thị.", "error");
    }
  }
  function status(id, value) {
    workspace.updateStatus.mutate({ id, status: value });
  }
  function resetPassword(item) {
    if (!window.confirm(`Cấp lại mật khẩu tạm cho ${item.fullName}? Các phiên đăng nhập hiện tại sẽ bị thu hồi.`)) return;
    setPassword(null);
    setCredentialEmailDelivered(null);
    workspace.resetPassword.mutate(item.id, { onSuccess: (result) => {
      setPassword(result.temporaryPassword ?? null);
      setCredentialEmailDelivered(result.credentialEmailDelivered === true);
    } });
  }
  function openEdit(item) {
    workspace.clearFeedback();
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
              : "Email chưa gửi được hoặc chưa cấu hình SMTP. Người thực hiện vui lòng gửi riêng thông tin cho nhân viên; mật khẩu này không được lưu hoặc hiển thị lại."}
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
              maxLength={120}
              minLength={2}
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
            <input aria-describedby={validationError ? "staff-create-phone-error" : undefined} aria-invalid={Boolean(validationError)} maxLength={20} minLength={9} name="phone" onChange={update} ref={phoneInputRef} required value={form.phone} />
          </label>
          {validationError && <p className="field-error" id="staff-create-phone-error" role="alert">{validationError}</p>}
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
            <TableSkeleton columns={6} />
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
                      {session?.user?.role === "admin" && <>{" "}<Button disabled={submitting} onClick={() => resetPassword(item)} size="sm" variant="outline">Cấp lại MK</Button></>}
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
      <StaffEditDialog clearFeedback={workspace.clearFeedback} detail={workspace.detail} editingId={editingId} loading={workspace.detailLoading} onClose={() => setEditingId(null)} onSubmit={save} />
    </main>
  );
}

function StaffEditDialog({ clearFeedback, detail, editingId, loading, onClose, onSubmit }) {
  if (!editingId) return null;
  const close = () => { if (!loading) onClose(); };
  return <Dialog isOpen onClose={close} title="Cập nhật nhân viên">{loading && !detail ? <p className="dialog__body">Đang tải hồ sơ…</p> : detail && <StaffEditForm clearFeedback={clearFeedback} detail={detail} loading={loading} onClose={close} onSubmit={onSubmit} />}</Dialog>;
}

function StaffEditForm({ clearFeedback, detail, loading, onClose, onSubmit }) {
  const [form, setForm] = useState({ fullName: detail.fullName, email: detail.email, phone: detail.phone ?? "", role: detail.role, specialties: detail.specialties ?? [] });
  const [validationError, setValidationError] = useState("");
  const phoneInputRef = useRef(null);
  function submit(event) {
    event.preventDefault();
    if (!hasValidPhoneLength(form.phone)) {
      clearFeedback();
      setValidationError(phoneLengthError);
      phoneInputRef.current?.focus();
      return;
    }
    onSubmit(form);
  }
  return (
    <form onSubmit={submit}>
      <div className="dialog__body">
        <label>Họ tên<input disabled={loading} maxLength={120} minLength={2} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} required value={form.fullName} /></label>
        <label>Email<input disabled type="email" value={form.email} /></label>
        <label>Số điện thoại<input aria-describedby={validationError ? "staff-edit-phone-error" : undefined} aria-invalid={Boolean(validationError)} disabled={loading} maxLength={20} minLength={9} onChange={(event) => { clearFeedback(); setValidationError(""); setForm((current) => ({ ...current, phone: event.target.value })); }} ref={phoneInputRef} required value={form.phone} /></label>
        {validationError && <p className="field-error" id="staff-edit-phone-error" role="alert">{validationError}</p>}
        <label>Vai trò<select disabled={loading} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} value={form.role}><option value="receptionist">Lễ tân</option><option value="coach">Huấn luyện viên</option><option value="manager">Quản lý</option></select></label>
        <label>Chuyên môn (cách nhau bởi dấu phẩy)<input disabled={loading} onChange={(event) => setForm((current) => ({ ...current, specialties: event.target.value.split(",").map((value) => value.trim()) }))} value={form.specialties.join(", ")} /></label>
      </div>
      <div className="dialog__actions"><Button disabled={loading} onClick={onClose} type="button" variant="secondary">Hủy</Button><Button loading={loading} type="submit">Lưu thay đổi</Button></div>
    </form>
  );
}
