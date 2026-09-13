import { BarChart3, CalendarDays, CreditCard, Dumbbell, Users } from "lucide-react";
import "./auth.css";

const features = [
  [Users, "Quản lý hội viên", "Hồ sơ, gói tập, lịch sử điểm danh"],
  [CalendarDays, "Lớp học & điểm danh", "Lịch lớp, đặt chỗ, điểm danh"],
  [CreditCard, "Thanh toán", "Ghi nhận, theo dõi giao dịch"],
  [BarChart3, "Báo cáo vận hành", "Doanh thu và hiệu suất"],
];

export function AuthLayout({ children }) {
  return <main className="auth-layout">
    <section className="auth-brand" aria-label="Giới thiệu hệ thống">
      <div className="auth-logo"><span><Dumbbell size={18} aria-hidden="true" /></span><div><strong>Kinetic</strong><small>Sports Center</small></div></div>
      <div className="auth-brand__content"><p className="auth-eyebrow">Nền tảng quản lý</p><h1>Một hệ thống.<br /><em>Mọi vận hành.</em></h1><p className="auth-brand__lead">Quản lý hội viên, lớp học, thanh toán và nhân sự trong một nền tảng có phân quyền rõ ràng.</p>
        <div className="auth-features">{features.map(([Icon, title, description]) => <div className="auth-feature" key={title}><span><Icon size={15} aria-hidden="true" /></span><p><strong>{title}</strong><small>{description}</small></p></div>)}</div>
      </div>
      <p className="auth-brand__footer">© 2026 Kinetic Sports Center</p>
    </section>
    <section className="auth-panel">{children}</section>
  </main>;
}
