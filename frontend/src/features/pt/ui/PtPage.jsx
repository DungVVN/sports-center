import { useEffect, useState } from "react";
import { Button } from "../../../shared/ui/Button.jsx";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { usePtWorkspace } from "../api/usePtWorkspace.js";
import { PtPackageForm, PtBookingForm, PtDecisionForm } from "./PtForms.jsx";
import { hasSessionPermission } from "../../auth/index.js";
import "./pt.css";
const money = (value) => `${Number(value).toLocaleString("vi-VN")} đ`;
const time = (value) => value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa kích hoạt";
const labels = { pending_payment: "Chờ thanh toán", active: "Đã kích hoạt", scheduled: "Đã đặt", completed: "Hoàn thành", absent: "Vắng mặt", cancelled: "Đã hủy" };
export function PtPage({ session, onNavigate }) {
  const { packages, purchases, resources, canManage, canPurchase, canComplete, mutation } = usePtWorkspace(session);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 60_000); return () => clearInterval(timer); }, []);
  const [notice, setNotice] = useState("");
  const [payment, setPayment] = useState(null);
  const [coaches, setCoaches] = useState({});
  async function submit(operation) {
    setNotice("");
    try {
      const result = await mutation.mutateAsync(operation);
      if (operation.action === "payment") setPayment(result);
      setNotice("Đã lưu thao tác PT.");
      return true;
    } catch { return false; }
  }
  return <main className="members-page pt-page">
    <h1>Huấn luyện cá nhân</h1>
    <p>Mua số buổi PT độc lập với membership. Hạn dùng tính từ khi kích hoạt. Trung tâm phân công coach; đặt lịch giữ buổi, hoàn thành hoặc vắng mặt sử dụng buổi.</p>
    {notice && <p role="status">{notice}</p>}
    {mutation.isError && <p role="alert">{errorMessageFor(mutation.error, "Không xử lý được PT.")}</p>}
    {canManage && <PtPackageForm onSubmit={submit} pending={mutation.isPending} />}
    {[packages, purchases, resources].map((query, index) => query.isError && <p key={index} role="alert">{errorMessageFor(query.error, "Không tải được dữ liệu PT.")} <Button onClick={() => query.refetch()}>Thử lại</Button></p>)}
    {(packages.isPending || purchases.isPending) && <p role="status">Đang tải PT...</p>}
    <section aria-label="Danh mục PT" className="pt-grid">
      {(packages.data ?? []).map((pack) => <article className="pt-card" key={pack.id}>
        <h2>{pack.name}</h2><p>{money(pack.priceVnd)} · {pack.session_count} buổi · {pack.duration_days} ngày từ khi kích hoạt</p>
        <p>{pack.session_minutes} phút/buổi · Hủy trước {pack.cancellation_hours} giờ</p>
        {canManage && <Button loading={mutation.isPending} onClick={() => submit({ action: "setPackageActive", id: pack.id, input: { isActive: !pack.is_active } })}>{pack.is_active ? "Dừng bán gói" : "Mở bán gói"}</Button>}
        {canPurchase && <Button loading={mutation.isPending} onClick={() => submit({ action: "buy", id: pack.id })}>Mua gói PT</Button>}
      </article>)}
      {!packages.isPending && !packages.isError && !packages.data?.length && <p>Chưa có gói PT.</p>}
    </section>
    <section aria-label="Gói PT trong phạm vi">
      <h2>{canPurchase ? "PT của tôi" : "Gói PT và lịch phụ trách"}</h2>
      {(purchases.data ?? []).map((purchase) => <article key={purchase.id} className="pt-card">
        <h3>{purchase.package_name_snapshot}</h3><p>{purchase.status === "active" && new Date(purchase.expires_at) <= clock ? "Hết hạn" : labels[purchase.status]} · {money(purchase.priceVnd)}</p>
        <p>Đã dùng: {purchase.usedSessions}; chưa dùng/chưa đặt: {purchase.remainingSessions}/{purchase.session_count_snapshot}. Hết hạn: {time(purchase.expires_at)}.</p>
        <p>Coach: {resources.data?.coaches.find((coach) => coach.id === purchase.coach_user_id)?.display_name ?? "Chờ trung tâm phân công"}</p>
        {canPurchase && purchase.status === "pending_payment" && <Button loading={mutation.isPending} onClick={() => submit({ action: "cancelPurchase", id: purchase.id })}>Hủy đăng ký PT chưa thanh toán</Button>}
        {canPurchase && purchase.status === "pending_payment" && ["bank_transfer", "online"].map((method) => <Button key={method} loading={mutation.isPending} onClick={() => submit({ action: "payment", id: purchase.id, input: { method } })}>{method === "online" ? "Thanh toán PayOS" : "Lập thanh toán chuyển khoản"}</Button>)}
        {canManage && purchase.status === "active" && <form className="pt-form" onSubmit={(event) => { event.preventDefault(); void submit({ action: "assign", id: purchase.id, input: { coachUserId: coaches[purchase.id] } }); }}>
          <label>Phân công coach<select required value={coaches[purchase.id] ?? ""} onChange={(event) => setCoaches({ ...coaches, [purchase.id]: event.target.value })}><option value="">Chọn coach</option>{(resources.data?.coaches ?? []).map((coach) => <option key={coach.id} value={coach.id}>{coach.display_name}</option>)}</select></label>
          <Button type="submit" loading={mutation.isPending}>Lưu coach</Button>
        </form>}
        {canPurchase && purchase.status === "active" && purchase.coach_user_id && purchase.remainingSessions > 0 && new Date(purchase.expires_at) > clock && <PtBookingForm purchase={purchase} rooms={resources.data?.rooms ?? []} onSubmit={submit} pending={mutation.isPending} />}
        <ul>{purchase.appointments.map((appointment) => <li key={appointment.id}>
          <strong>{time(appointment.session?.starts_at)}</strong> · {labels[appointment.status]}
          {appointment.reason && <p>{appointment.reason}</p>}
          {appointment.status === "scheduled" && <PtDecisionForm appointment={appointment} canCancel={canPurchase || canManage} canComplete={canComplete} onSubmit={submit} pending={mutation.isPending} />}
        </li>)}</ul>
        {canPurchase && hasSessionPermission(session, "training.self.read") && onNavigate && <Button variant="ghost" onClick={() => onNavigate("my-training")}>Xem tiến độ tập luyện</Button>}
      </article>)}
      {!purchases.isPending && !purchases.isError && !purchases.data?.length && <p>Chưa có gói PT trong phạm vi của bạn.</p>}
    </section>
    {payment && <section aria-label="Thanh toán PT"><h2>Giao dịch {payment.transaction_code}</h2><p>{money(payment.amountVnd)} · Chỉ cấp quyền khi thanh toán được xác nhận.</p>{payment.checkoutUrl && <a href={payment.checkoutUrl} target="_blank" rel="noreferrer">Mở thanh toán PayOS</a>}{onNavigate && <Button onClick={() => onNavigate("my-payments")}>Xem phiếu thu</Button>}</section>}
  </main>;
}
