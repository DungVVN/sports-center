import { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "../../shared/ui/Button.jsx";
import { authApi } from "./auth-api.js";
import { AuthLayout } from "./AuthLayout.jsx";
import { CaptchaField } from "./CaptchaField.jsx";
import { validateCredentials } from "./auth-validation.js";
import { errorMessageFor } from "../../shared/api/error-message.js";
import { useToast } from "../../shared/ui/useToast.js";

export function LoginPage({ onLoggedIn, onMfaRequired, onRegister }) {
  const [input, setInput] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const showToast = useToast();
  const fieldErrors = validateCredentials(input);

  const update = (event) => {
    setTouched((current) => ({ ...current, [event.target.name]: true }));
    setInput((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  async function submit(event) {
    event.preventDefault();
    setError("");
    setTouched({ email: true, password: true });
    if (Object.keys(fieldErrors).length) { showToast?.(Object.values(fieldErrors).join(" "), "error"); return; }
    setLoading(true);
    try {
      const login = await authApi.login(input);
      if (login.mfaRequired) {
        showToast?.("Mật khẩu đúng. Vui lòng nhập mã xác thực để hoàn tất đăng nhập.", "success");
        onMfaRequired(login);
        return;
      }
      const current = await authApi.me();
      showToast?.("Đăng nhập thành công.", "success");
      onLoggedIn({ ...login, ...current });
    } catch (caught) {
      const message = errorMessageFor(caught, "Không thể đăng nhập.");
      setError(message);
      showToast?.(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card auth-card--login">
        <h2>Đăng nhập</h2>
        <p className="auth-card__subtitle">Nhập thông tin tài khoản để tiếp tục.</p>
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input aria-invalid={Boolean(touched.email && fieldErrors.email)} className={touched.email && fieldErrors.email ? "input-error" : ""} id="login-email" name="email" value={input.email} onChange={update} type="email" autoComplete="email" required />
            {touched.email && fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </div>
          <div className="field">
            <label htmlFor="login-password">Mật khẩu</label>
            <div className="password-input-wrapper">
              <input
                id="login-password"
                aria-invalid={Boolean(touched.password && fieldErrors.password)}
                className={touched.password && fieldErrors.password ? "input-error" : ""}
                name="password"
                value={input.password}
                onChange={update}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
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
            <LogIn size={17} aria-hidden="true" />
            Đăng nhập
          </Button>
        </form>
        <p className="auth-note">
          Chưa có tài khoản?{" "}
          <button className="auth-link" type="button" onClick={onRegister}>
            Đăng ký hội viên
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
