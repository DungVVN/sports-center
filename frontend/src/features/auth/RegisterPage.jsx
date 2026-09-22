import { useState } from "react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { ApiError } from "../../api/api-error.js";
import { Button } from "../../components/ui/Button.jsx";
import { authApi } from "./auth-api.js";
import { AuthLayout } from "./AuthLayout.jsx";
import { CaptchaField } from "./CaptchaField.jsx";

export function RegisterPage({ onLogin, onRegistered }) {
  const [input, setInput] = useState({ fullName: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (event) => setInput((current) => ({ ...current, [event.target.name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (input.password !== input.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        password: input.password,
        ...(input.captchaToken ? { captchaToken: input.captchaToken } : {}),
      };
      const registration = await authApi.register(payload);
      onRegistered({
        userId: registration.user.id,
        channels: registration.verifications.map(({ channel }) => channel),
        developmentCodes: Object.fromEntries(
          registration.verifications.filter((item) => item.developmentCode).map((item) => [item.channel, item.developmentCode]),
        ),
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Không thể tạo tài khoản.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <h2>Tạo tài khoản hội viên</h2>
        <p className="auth-card__subtitle">Xác thực email, sau đó chờ Lễ tân duyệt.</p>
        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="register-name">Họ và tên</label>
            <input id="register-name" name="fullName" value={input.fullName} onChange={update} autoComplete="name" required minLength="2" />
          </div>
          <div className="field">
            <label htmlFor="register-email">Email</label>
            <input id="register-email" name="email" value={input.email} onChange={update} type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="register-phone">Số điện thoại</label>
            <input id="register-phone" name="phone" value={input.phone} onChange={update} type="tel" inputMode="tel" autoComplete="tel" placeholder="0901234567" required />
          </div>
          <div className="field">
            <label htmlFor="register-password">Mật khẩu</label>
            <div className="password-input-wrapper">
              <input
                id="register-password"
                name="password"
                value={input.password}
                onChange={update}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength="8"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
            <small>Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.</small>
          </div>
          <div className="field">
            <label htmlFor="register-confirm-password">Xác nhận mật khẩu</label>
            <div className="password-input-wrapper">
              <input
                id="register-confirm-password"
                name="confirmPassword"
                value={input.confirmPassword}
                onChange={update}
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength="8"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? "Ẩn xác nhận mật khẩu" : "Hiện xác nhận mật khẩu"}
              >
                {showConfirmPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>
          <CaptchaField
            onTokenChange={(captchaToken) =>
              setInput((current) => {
                const next = { ...current };
                if (captchaToken) next.captchaToken = captchaToken;
                else delete next.captchaToken;
                return next;
              })
            }
          />
          {error && <p className="auth-alert" role="alert">{error}</p>}
          <Button type="submit" size="lg" loading={loading}>
            <UserPlus size={17} aria-hidden="true" />
            Đăng ký
          </Button>
        </form>
        <p className="auth-note">
          Đã có tài khoản?{" "}
          <button className="auth-link" type="button" onClick={onLogin}>
            Đăng nhập
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
