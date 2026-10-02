import { PageHeader } from "../../../shared/ui/PageHeader.jsx";
import { Button } from "../../../shared/ui/Button.jsx";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { useMyServices } from "../api/useMyServices.js";
import "./services.css";

const labels = { pending_payment: "Chờ thanh toán", pending: "Chờ duyệt", active: "Đang sử dụng", expiring_soon: "Sắp hết hạn", expired: "Hết hạn", frozen: "Đóng băng", cancelled: "Đã hủy", approved: "Đã duyệt", rejected: "Từ chối", completed: "Hoàn thành" };
const name = (item) => item.package_name_snapshot ?? item.course?.name ?? item.facilityName ?? "Dịch vụ";
const date = (value) => value ? new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa kích hoạt";

export function MyServicesPage({ session, onNavigate }) {
  const groups = useMyServices(session);
  return <main className="members-page my-services">
    <PageHeader eyebrow="Dịch vụ" title="Dịch vụ của tôi" description="Gói hội viên, khóa học, PT và sân/phòng dùng chung tài khoản. Mỗi dịch vụ có quyền sử dụng và điều kiện thanh toán riêng." actions={<Button variant="ghost" onClick={() => onNavigate("bookings")}>Xem lịch của tôi</Button>} />
    <div className="my-services__groups">
      {groups.filter(({ query }) => query.isEnabled).map(({ type, label, view, query }) => <section className="my-services__group" key={type} aria-label={label}>
        <h2>{label}</h2>
        {query.isPending && <p role="status">Đang tải...</p>}
        {query.isError && <p role="alert">{errorMessageFor(query.error, "Không tải được dịch vụ.")} <Button onClick={() => query.refetch()}>Thử lại</Button></p>}
        {query.data?.length === 0 && <p>Bạn chưa đăng ký dịch vụ này.</p>}
        {(query.data ?? []).map((item) => <article key={item.id}>
          <h3>{name(item)}</h3>
          <p>{item.completedAt ? "Đã chốt sử dụng" : labels[item.status] ?? item.status}</p>
          {type === "membership" && <p>Hạn dùng: {date(item.expires_on)}</p>}
          {type === "pt" && <p>Đã dùng: {item.usedSessions}; chưa dùng/chưa đặt: {item.remainingSessions}/{item.session_count_snapshot}. Hạn dùng: {date(item.expires_at)}</p>}
          {type === "course" && <p>Thanh toán xác nhận sẽ cấp quyền cho toàn bộ lịch khóa.</p>}
          {type === "facility" && <p>{item.date} · {item.totalVnd == null ? "Chưa có giá chốt" : `${Number(item.totalVnd).toLocaleString("vi-VN")} đ`} · {{ refunded: "Đã hoàn tiền", unpaid: "Chờ thanh toán", paid: "Đã thanh toán", free: "Miễn phí", legacy: "Đơn lịch sử" }[item.paymentState]}</p>}
        </article>)}
        <Button onClick={() => onNavigate(view)}>Xem và quản lý {label.toLowerCase()}</Button>
      </section>)}
    </div>
  </main>;
}
