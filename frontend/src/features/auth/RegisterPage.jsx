import { useState } from "react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { errorMessageFor, fieldErrorsFor } from "../../shared/api/error-message.js";
import { Button } from "../../shared/ui/Button.jsx";
import { authApi } from "./auth-api.js";
import { AuthLayout } from "./AuthLayout.jsx";
import { CaptchaField } from "./CaptchaField.jsx";
import { validateRegistration } from "./auth-validation.js";
import { useToast } from "../../shared/ui/useToast.js";

export function RegisterPage({ onLogin, onRegistered }) {
  const [input, setInput] = useState({ fullName: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [serverFieldErrors, setServerFieldErrors] = useState({});
  const showToast = useToast();
  const fieldErrors = { ...validateRegistration(input), ...serverFieldErrors };

  const update = (event) => {
    const { name, value } = event.target;
    setTouched((current) => ({ ...current, [name]: true }));
    setServerFieldErrors((current) => ({ ...current, [name]: undefined }));
    setInput((current) => ({ ...current, [name]: value }));
  };

  async function submit(event) {
    event.preventDefault();
    setError("");
    setTouched({ fullName: true, email: true, phone: true, password: true, confirmPassword: true });
    const localErrors = validateRegistration(input);
    if (Object.keys(localErrors).length) { showToast?.(Object.values(localErrors).join(" "), "error"); return; }
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
      showToast?.("Đã tạo tài khoản và gửi mã xác thực email.", "success");
      onRegistered({
        userId: registration.user.id,
        channels: registration.verifications.map(({ channel }) => channel),
        developmentCodes: Object.fromEntries(
          registration.verifications.filter((item) => item.developmentCode).map((item) => [item.channel, item.developmentCode]),
        ),
      });
    } catch (caught) {
      setServerFieldErrors(fieldErrorsFor(caught));
      const message = errorMessageFor(caught, "Không thể tạo tài khoản.");
      setError(message);
      showToast?.(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <h2>Tạo tài khoản hội viên</h2>
        <p className="auth-card__subtitle">Xác thực email, sau đó chờ Lễ tân duyệt.</p>
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="register-name">Họ và tên</label>
            <input aria-invalid={Boolean(touched.fullName && fieldErrors.fullName)} className={touched.fullName && fieldErrors.fullName ? "input-error" : ""} id="register-name" name="fullName" value={input.fullName} onChange={update} autoComplete="name" required minLength="2" />
            {touched.fullName && fieldErrors.fullName && <span className="field-error">{fieldErrors.fullName}</span>}
          </div>
          <div className="field">
            <label htmlFor="register-email">Email</label>
            <input aria-invalid={Boolean(touched.email && fieldErrors.email)} className={touched.email && fieldErrors.email ? "input-error" : ""} id="register-email" name="email" value={input.email} onChange={update} type="email" autoComplete="email" required />
            {touched.email && fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </div>
          <div className="field">
            <label htmlFor="register-phone">Số điện thoại</label>
            <input aria-invalid={Boolean(touched.phone && fieldErrors.phone)} className={touched.phone && fieldErrors.phone ? "input-error" : ""} id="register-phone" name="phone" value={input.phone} onChange={update} type="tel" inputMode="tel" autoComplete="tel" placeholder="0901234567" required />
            {touched.phone && fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
          </div>
          <div className="field">
            <label htmlFor="register-password">Mật khẩu</label>
            <div className="password-input-wrapper">
              <input
                id="register-password"
                aria-invalid={Boolean(touched.password && fieldErrors.password)}
                className={touched.password && fieldErrors.password ? "input-error" : ""}
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
            {touched.password && fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
            <small>Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.</small>
          </div>
          <div className="field">
            <label htmlFor="register-confirm-password">Xác nhận mật khẩu</label>
            <div className="password-input-wrapper">
              <input
                id="register-confirm-password"
                aria-invalid={Boolean(touched.confirmPassword && fieldErrors.confirmPassword)}
                className={touched.confirmPassword && fieldErrors.confirmPassword ? "input-error" : ""}
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
            {touched.confirmPassword && fieldErrors.confirmPassword && <span className="field-error">{fieldErrors.confirmPassword}</span>}
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
