import { useState } from "react";
import { LogIn } from "lucide-react";
import { Button } from "../../components/ui/Button.jsx";
import { ApiError } from "../../api/api-error.js";
import { authApi } from "./auth-api.js";
import { AuthLayout } from "./AuthLayout.jsx";

export function LoginPage({ onLoggedIn, onRegister }) {
  const [input, setInput] = useState({ email: "", password: "" }); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const update = (event) => setInput((current) => ({ ...current, [event.target.name]: event.target.value }));
  async function submit(event) { event.preventDefault(); setError(""); setLoading(true); try { const login = await authApi.login(input); const current = await authApi.me(); onLoggedIn({ ...login, ...current }); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Không thể đăng nhập. Vui lòng thử lại."); } finally { setLoading(false); } }
  return <AuthLayout><div className="auth-card"><h2>Đăng nhập</h2><p className="auth-card__subtitle">Nhập thông tin tài khoản để tiếp tục.</p><form className="auth-form" onSubmit={submit}><div className="field"><label htmlFor="login-email">Email</label><input id="login-email" name="email" value={input.email} onChange={update} type="email" autoComplete="email" required /></div><div className="field"><label htmlFor="login-password">Mật khẩu</label><input id="login-password" name="password" value={input.password} onChange={update} type="password" autoComplete="current-password" required /></div>{error && <p className="auth-alert" role="alert">{error}</p>}<Button type="submit" size="lg" loading={loading}><LogIn size={17} aria-hidden="true" />Đăng nhập</Button></form><p className="auth-note">Chưa có tài khoản? <button className="auth-link" type="button" onClick={onRegister}>Đăng ký hội viên</button></p></div></AuthLayout>;
}
