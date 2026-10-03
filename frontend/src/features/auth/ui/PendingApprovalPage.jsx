import { Clock3 } from "lucide-react";
import { AuthLayout } from "./AuthLayout.jsx";

export function PendingApprovalPage({ onLogin }) {
  return (
    <AuthLayout>
      <div className="auth-card" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div className="auth-status-icon" style={{ background: "var(--color-success-soft)", color: "var(--color-success-text)" }}>
          <Clock3 size={26} aria-hidden="true" />
        </div>
        <h2>Đang chờ duyệt</h2>
        <p className="auth-card__subtitle" style={{ marginBottom: "20px" }}>
          Tài khoản đã xác thực email thành công. Lễ tân sẽ kiểm tra và kích hoạt tài khoản của bạn trước khi bạn đăng nhập.
        </p>
        <div style={{ background: "var(--color-success-soft)", border: "1px solid var(--color-success-border)", borderRadius: "var(--radius-card)", padding: "14px 16px", color: "var(--color-success-text)", fontSize: "var(--font-size-label)", marginBottom: "24px", width: "100%" }}>
          Chúng tôi sẽ gửi thông báo đến email của bạn ngay khi tài khoản được phê duyệt.
        </div>
        <button className="auth-link" type="button" onClick={onLogin}>
          Quay lại đăng nhập
        </button>
      </div>
    </AuthLayout>
  );
}
