import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { ApiError } from "../../api/api-error.js";
import { Button } from "../../components/ui/Button.jsx";
import { DataTableToolbar, FilterMenu, SortableHeader } from "../../components/ui/DataTable.jsx";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { usePagination } from "../../components/ui/usePagination.js";
import { sortTable } from "../../lib/table.js";
import { staffApi } from "./staff-api.js";
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
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(empty);
  const [password, setPassword] = useState(null);
  const [credentialEmailDelivered, setCredentialEmailDelivered] = useState(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffRoleFilters, setStaffRoleFilters] = useState([]);
  const [staffStatusFilters, setStaffStatusFilters] = useState([]);
  const [isStaffFilterOpen, setIsStaffFilterOpen] = useState(false);
  const [staffSort, setStaffSort] = useState({ key: "fullName", direction: "asc" });
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
  const load = async () => {
    setLoading(true);
    try {
      setStaff(await staffApi.list());
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Không tải được nhân viên.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);
  const update = (event) =>
    setForm((value) => ({ ...value, [event.target.name]: event.target.value }));
  async function create(event) {
    event.preventDefault();
    setError("");
    setCredentialEmailDelivered(null);
    setSubmitting(true);
    try {
      const result = await staffApi.create(form);
      setPassword(result.temporaryPassword ?? null);
      setCredentialEmailDelivered(result.credentialEmailDelivered === true);
      setStaff((items) => [result.staff, ...items]);
      setForm(empty);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Không thể tạo nhân viên.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  function copyPassword() {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  }
  async function status(id, value) {
    setError("");
    setSubmitting(true);
    try {
      const changed = await staffApi.setStatus(id, value);
      setStaff((items) =>
        items.map((item) => (item.id === id ? changed : item)),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Không thể cập nhật trạng thái.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  async function openEdit(item) {
    setError("");
    setSubmitting(true);
    try {
      const detail = await staffApi.get(item.id);
      setEditing(detail);
      setEditForm({
        fullName: detail.fullName,
        email: detail.email,
        phone: detail.phone ?? "",
        role: detail.role,
        specialties: detail.specialties ?? [],
      });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }
  async function save(event) {
    event.preventDefault();
    if (!editing) return;
    setError("");
    setSubmitting(true);
    try {
      const updated = await staffApi.update(editing.id, {
        ...editForm,
        specialties: editForm.specialties.filter(Boolean),
      });
      setStaff((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setEditing(null);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="staff-page">
      <header>
        <p>Quản trị</p>
        <h1>Quản lý nhân viên</h1>
      </header>
      {error && (
        <p className="auth-alert" role="alert">
          {error}
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
        <p className="auth-alert auth-alert--success" role="status">
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
          <div className="list-heading"><h2>Danh sách nhân viên</h2><Button onClick={load} size="sm" variant="ghost">Tải lại</Button></div>
          {loading ? (
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
      <Dialog
        isOpen={Boolean(editing)}
        onClose={() => !submitting && setEditing(null)}
        title="Cập nhật nhân viên"
      >
        <form onSubmit={save}>
          <div className="dialog__body">
            <label>
              Họ tên
              <input
                onChange={(event) =>
                  setEditForm({ ...editForm, fullName: event.target.value })
                }
                required
                value={editForm.fullName}
              />
            </label>
            <label>
              Email
              <input disabled type="email" value={editForm.email} />
            </label>
            <label>
              Số điện thoại
              <input
                onChange={(event) =>
                  setEditForm({ ...editForm, phone: event.target.value })
                }
                required
                value={editForm.phone}
              />
            </label>
            <label>
              Vai trò
              <select
                onChange={(event) =>
                  setEditForm({ ...editForm, role: event.target.value })
                }
                value={editForm.role}
              >
                <option value="receptionist">Lễ tân</option>
                <option value="coach">Huấn luyện viên</option>
                <option value="manager">Quản lý</option>
              </select>
            </label>
            <label>
              Chuyên môn (cách nhau bởi dấu phẩy)
              <input
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    specialties: event.target.value
                      .split(",")
                      .map((value) => value.trim()),
                  })
                }
                value={editForm.specialties.join(", ")}
              />
            </label>
          </div>
          <div className="dialog__actions">
            <Button
              onClick={() => setEditing(null)}
              type="button"
              variant="secondary"
            >
              Hủy
            </Button>
            <Button loading={submitting} type="submit">
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Dialog>
    </main>
  );
}
