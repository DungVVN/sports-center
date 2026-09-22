import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { ApiError } from "../../api/api-error.js";
import { Button } from "../../components/ui/Button.jsx";
import { authApi } from "./auth-api.js";
import { AuthLayout } from "./AuthLayout.jsx";

export function InitialPasswordChangePage({ onCompleted }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.newPassword !== form.confirmPassword) {
      setError("Xác nhận mật khẩu mới không khớp.");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      onCompleted();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Không thể đổi mật khẩu. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  const passwordField = (id, label, value, visibleKey, autoComplete) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrapper">
        <input autoComplete={autoComplete} id={id} minLength="8" onChange={(event) => update(value, event.target.value)} required type={show[visibleKey] ? "text" : "password"} value={form[value]} />
        <button aria-label={show[visibleKey] ? `Ẩn ${label.toLocaleLowerCase("vi")}` : `Hiện ${label.toLocaleLowerCase("vi")}`} className="password-toggle-btn" onClick={() => setShow((current) => ({ ...current, [visibleKey]: !current[visibleKey] }))} type="button">
          {show[visibleKey] ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );

  return (
    <AuthLayout>
      <div className="auth-card">
        <KeyRound aria-hidden="true" size={26} />
        <h2>Đổi mật khẩu lần đầu</h2>
        <p className="auth-card__subtitle">Để bảo vệ tài khoản, hãy thay mật khẩu tạm thời trước khi vào hệ thống.</p>
        <form className="auth-form" onSubmit={submit}>
          {passwordField("initial-current-password", "Mật khẩu tạm thời", "currentPassword", "current", "current-password")}
          {passwordField("initial-new-password", "Mật khẩu mới", "newPassword", "next", "new-password")}
          {passwordField("initial-confirm-password", "Xác nhận mật khẩu mới", "confirmPassword", "confirm", "new-password")}
          <small>Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.</small>
          {error && <p className="auth-alert" role="alert">{error}</p>}
          <Button loading={submitting} size="lg" type="submit">Lưu mật khẩu mới</Button>
        </form>
      </div>
    </AuthLayout>
  );
}
