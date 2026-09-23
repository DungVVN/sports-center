import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { DataTableToolbar, FilterMenu, SortableHeader } from "../../components/ui/DataTable.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { usePagination } from "../../components/ui/usePagination.js";
import { sortTable } from "../../lib/table.js";
import { memberApi } from "../members/member-api.js";
import { membershipApi } from "../memberships/membership-api.js";
import { paymentApi } from "./payment-api.js";
import { hasSessionPermission } from "../../utils/session-permissions.js";
import "../members/members.css";

const emptyForm = { memberId: "", membershipId: "", amountVnd: "", method: "cash", provider: "payos", notes: "" };
const paymentStatus = {
  pending: "Chờ xác nhận",
  paid: "Đã thanh toán",
  failed: "Thất bại",
  refunded: "Đã hoàn tiền",
};
const methodLabel = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản", online: "Trực tuyến" };

export function PaymentsPage({ session }) {
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [reconciliationNotes, setReconciliationNotes] = useState({});
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatusFilters, setPaymentStatusFilters] = useState([]);
  const [paymentMethodFilters, setPaymentMethodFilters] = useState([]);
  const [paymentPackageFilters, setPaymentPackageFilters] = useState([]);
  const [isPaymentFilterOpen, setIsPaymentFilterOpen] = useState(false);
  const [paymentSort, setPaymentSort] = useState({ key: "amountVnd", direction: "desc" });
  const isCashier = hasSessionPermission(session, "payment.record");
  const paymentPackages = useMemo(
    () =>
      [...new Set(items.map((item) => item.membership?.packageName).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, "vi")),
    [items],
  );
  const visiblePayments = useMemo(() => {
    const query = paymentSearch.trim().toLocaleLowerCase("vi");
    const filtered = items.filter((item) => {
      const searchable = [item.transaction_code, item.member?.fullName, item.member?.memberCode, item.membership?.packageName]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase("vi").includes(query));
      const matchesStatus = !paymentStatusFilters.length || paymentStatusFilters.includes(item.status);
      const matchesMethod = !paymentMethodFilters.length || paymentMethodFilters.includes(item.method);
      const matchesPackage = !paymentPackageFilters.length || paymentPackageFilters.includes(item.membership?.packageName);
      return matchesStatus && matchesMethod && matchesPackage && (!query || searchable);
    });
    return sortTable(filtered, paymentSort.key, paymentSort.direction, (item, key) => item[key]);
  }, [items, paymentStatusFilters, paymentMethodFilters, paymentPackageFilters, paymentSearch, paymentSort]);
  const paymentsPagination = usePagination(visiblePayments);

  function toggleFilterValue(setter, value) {
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }
  function togglePaymentSort(key) {
    setPaymentSort((value) => ({ key, direction: value.key === key && value.direction === "asc" ? "desc" : "asc" }));
  }
  const load = useCallback(async (memberId) => {
    setLoading(true);
    try {
      setItems(await paymentApi.list(memberId));
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(async () => {
      try {
        if (isCashier) setMembers(await memberApi.list());
      } catch (caught) {
        setError(caught.message);
      }
      await load();
    });
  }, [isCashier, load]);

  async function selectMember(memberId) {
    setForm((value) => ({
      ...value,
      memberId,
      membershipId: "",
      amountVnd: "",
    }));
    setMemberships([]);
    setError("");
    if (!memberId) {
      await load();
      return;
    }
    try {
      const [nextMemberships] = await Promise.all([
        membershipApi.byMember(memberId),
        load(memberId),
      ]);
      setMemberships(
        nextMemberships.filter((item) => item.status === "pending_payment"),
      );
    } catch (caught) {
      setError(caught.message);
    }
  }

  function selectMembership(membershipId) {
    const membership = memberships.find((item) => item.id === membershipId);
    setForm((value) => ({
      ...value,
      membershipId,
      amountVnd: membership ? String(membership.priceVnd) : value.amountVnd,
    }));
  }
  function updateForm(event) {
    setForm((value) => ({ ...value, [event.target.name]: event.target.value }));
  }

  async function create(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setCheckoutUrl("");
    setSubmitting(true);
    try {
      const payment = await paymentApi.create({
        ...form,
        membershipId: form.membershipId || undefined,
        amountVnd: Number(form.amountVnd),
      });
      setCheckoutUrl(payment.checkoutUrl ?? "");
      setForm(emptyForm);
      setMemberships([]);
      setNotice(payment.checkoutUrl ? "Đã tạo liên kết PayOS. Mở liên kết để khách thanh toán." : form.method === "bank_transfer" ? "Đã lập phiếu chuyển khoản chờ đối soát sao kê." : "Đã lập phiếu thu tiền mặt, chờ Lễ tân xác nhận đã thu.");
      await load();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirm(id, status, method) {
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await paymentApi.confirm(id, status, method === "bank_transfer" ? reconciliationNotes[id]?.trim() : undefined);
      setNotice(
        status === "paid"
          ? method === "bank_transfer" ? "Đã đối soát sao kê, xác nhận thanh toán và kích hoạt gói tập." : "Đã xác nhận thanh toán và kích hoạt gói tập."
          : "Đã ghi nhận giao dịch không thành công.",
      );
      await load(form.memberId || undefined);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="members-page">
      <header>
        <p>{isCashier ? "Thu tiền mặt" : "Thanh toán"}</p>
        <h1>{isCashier ? "Phiếu thu và kích hoạt gói" : "Theo dõi phiếu thu"}</h1>
      </header>
      {error && (
        <p className="auth-alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="auth-success" role="status">
          {notice}
        </p>
      )}
      <div className="members-workspace-stacked">
        {isCashier && <form className="members-form members-form--payment-create" onSubmit={create}>
          <h2>Lập phiếu thu</h2>
          <label>
            Phương thức
            <select name="method" onChange={updateForm} value={form.method}>
              <option value="cash">Tiền mặt tại quầy</option>
              <option value="bank_transfer">Chuyển khoản ngân hàng (đối soát)</option>
              <option value="online">Thanh toán trực tuyến</option>
            </select>
          </label>
          {form.method === "online" && <label>
            Cổng thanh toán
            <select name="provider" onChange={updateForm} value={form.provider}>
              <option value="payos">PayOS / chuyển khoản QR</option>
            </select>
          </label>}
          <label>
            Hội viên
            <select
              onChange={(event) => void selectMember(event.target.value)}
              required
              value={form.memberId}
            >
              <option value="">Chọn hội viên</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName} — {member.memberCode}
                </option>
              ))}
            </select>
          </label>
          <label>
            Gói chờ thanh toán
            <select
              disabled={!form.memberId}
              onChange={(event) => selectMembership(event.target.value)}
              value={form.membershipId}
            >
              <option value="">Không gắn gói tập</option>
              {memberships.map((membership) => (
                <option key={membership.id} value={membership.id}>
                  {membership.package_name_snapshot} —{" "}
                  {Number(membership.priceVnd).toLocaleString("vi-VN")} ₫
                </option>
              ))}
            </select>
          </label>
          <label>
            Số tiền (VNĐ)
            <input
              min="1"
              name="amountVnd"
              onChange={updateForm}
              required
              type="number"
              value={form.amountVnd}
            />
          </label>
          <label>
            Ghi chú
            <textarea name="notes" onChange={updateForm} value={form.notes} />
          </label>
          <Button loading={submitting} type="submit">
            Lập phiếu thu
          </Button>
        </form>}
        {checkoutUrl && <p className="auth-success" role="status">Liên kết thanh toán: <a href={checkoutUrl} rel="noreferrer" target="_blank">Mở trang thanh toán</a></p>}
        <section className="members-list">
          <div className="list-heading">
            <h2>{isCashier ? "Phiếu thu tại quầy" : "Danh sách phiếu thu"}</h2>
            <Button
              onClick={() => load(form.memberId || undefined)}
              size="sm"
              variant="ghost"
            >
              Tải lại
            </Button>
          </div>
          {loading ? (
            <p>Đang tải…</p>
          ) : items.length === 0 ? (
            <p>Chưa có giao dịch.</p>
          ) : (
            <>
              <DataTableToolbar onClear={() => { setPaymentSearch(""); setPaymentStatusFilters([]); setPaymentMethodFilters([]); setPaymentPackageFilters([]); }} resultCount={visiblePayments.length} search={paymentSearch} searchPlaceholder="Tìm mã, hội viên, gói..." setSearch={setPaymentSearch}>
                <FilterMenu activeCount={paymentStatusFilters.length + paymentMethodFilters.length + paymentPackageFilters.length} isOpen={isPaymentFilterOpen} onToggle={() => setIsPaymentFilterOpen((value) => !value)}>
                  <fieldset className="payment-filter-group">
                    <legend>Trạng thái phiếu thu</legend>
                    {Object.entries(paymentStatus).map(([value, label]) => (
                      <label key={value}>
                        <input checked={paymentStatusFilters.includes(value)} onChange={() => toggleFilterValue(setPaymentStatusFilters, value)} type="checkbox" />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="payment-filter-group">
                    <legend>Phương thức thanh toán</legend>
                    {Object.entries(methodLabel).map(([value, label]) => (
                      <label key={value}>
                        <input checked={paymentMethodFilters.includes(value)} onChange={() => toggleFilterValue(setPaymentMethodFilters, value)} type="checkbox" />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="payment-filter-group">
                    <legend>Gói tập</legend>
                    {paymentPackages.length ? paymentPackages.map((packageName) => (
                      <label key={packageName}>
                        <input checked={paymentPackageFilters.includes(packageName)} onChange={() => toggleFilterValue(setPaymentPackageFilters, packageName)} type="checkbox" />
                        {packageName}
                      </label>
                    )) : <p>Chưa có phiếu thu gắn gói tập.</p>}
                  </fieldset>
                </FilterMenu>
              </DataTableToolbar>
              {visiblePayments.length === 0 ? <p>Không có phiếu thu phù hợp với bộ lọc.</p> : <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <SortableHeader activeSort={paymentSort.key} column="transaction_code" direction={paymentSort.direction} onSort={togglePaymentSort}>Mã phiếu thu</SortableHeader>
                    <SortableHeader activeSort={paymentSort.key} column="updated_at" direction={paymentSort.direction} onSort={togglePaymentSort}>Thời gian xử lý</SortableHeader>
                    <th>Hội viên</th>
                    <th>Số điện thoại</th>
                    <th>Gói thanh toán</th>
                    <SortableHeader activeSort={paymentSort.key} column="amountVnd" direction={paymentSort.direction} onSort={togglePaymentSort}>Số tiền</SortableHeader>
                    <th>Phương thức</th>
                    <th>Trạng thái</th>
                    {isCashier && <th>Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {paymentsPagination.pageItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <code>{item.transaction_code}</code>
                      </td>
                      <td>{["paid", "failed"].includes(item.status) ? new Date(item.paid_at ?? item.updated_at).toLocaleString("vi-VN") : "—"}</td>
                      <td>
                        {item.member ? (
                          <>
                            <strong>{item.member.fullName}</strong>
                            <small>{item.member.memberCode}</small>
                          </>
                        ) : (
                          "Không tìm thấy hội viên"
                        )}
                      </td>
                      <td>{item.member?.phone ?? "—"}</td>
                      <td>
                        {item.membership ? (
                          <>
                            <strong>{item.membership.packageName}</strong>
                            <small>{paymentStatus[item.membership.status] ?? item.membership.status}</small>
                          </>
                        ) : (
                          "Không gắn gói tập"
                        )}
                      </td>
                      <td>
                        {Number(item.amountVnd).toLocaleString("vi-VN")} ₫
                      </td>
                      <td>{methodLabel[item.method] ?? item.method}</td>
                      <td>{paymentStatus[item.status] ?? item.status}</td>
                      {isCashier && <td>
                        {item.status === "pending" && item.method !== "online" && (
                          <div className="payment-table__actions">
                            {item.method === "bank_transfer" && <label>
                              Ghi chú đối soát sao kê
                              <textarea minLength="10" onChange={(event) => setReconciliationNotes((value) => ({ ...value, [item.id]: event.target.value }))} value={reconciliationNotes[item.id] ?? ""} />
                            </label>}
                            <Button
                              disabled={submitting || (item.method === "bank_transfer" && (reconciliationNotes[item.id]?.trim().length ?? 0) < 10)}
                              onClick={() => confirm(item.id, "paid", item.method)}
                              size="sm"
                            >
                              {item.method === "bank_transfer" ? "Xác nhận đã đối soát" : "Xác nhận đã thu"}
                            </Button>
                            <Button
                              disabled={submitting}
                              onClick={() => confirm(item.id, "failed", item.method)}
                              size="sm"
                              variant="danger"
                            >
                              Từ chối phiếu thu
                            </Button>
                          </div>
                        )}
                        {item.status === "pending" && item.method === "online" && <small>Chờ webhook PayOS</small>}
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>}
              <Pagination {...paymentsPagination} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
