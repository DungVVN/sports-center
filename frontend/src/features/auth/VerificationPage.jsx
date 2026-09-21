import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { ApiError } from "../../api/api-error.js";
import { Button } from "../../components/ui/Button.jsx";
import { authApi } from "./auth-api.js";
import { AuthLayout } from "./AuthLayout.jsx";

export function VerificationPage({ registration, onCompleted }) {
  const channel = "email"; const [code, setCode] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [resendMessage, setResendMessage] = useState("");
  async function submit(event) { event.preventDefault(); setError(""); setLoading(true); try { const result = await authApi.confirmVerification({ userId: registration.userId, channel, code }); setCode(""); if (result.status === "pending_approval") onCompleted(); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Không thể xác thực mã."); } finally { setLoading(false); } }
  async function resend() { setError(""); try { await authApi.resendVerification({ userId: registration.userId, channel }); setResendMessage("Đã gửi lại mã xác thực."); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Không thể gửi lại mã."); } }
  return <AuthLayout><div className="auth-card"><div className="auth-status-icon"><BadgeCheck size={25} aria-hidden="true" /></div><h2>Xác thực email</h2><p className="auth-card__subtitle">Nhập mã 6 số đã gửi đến email của bạn.</p><div className="auth-form">{import.meta.env.DEV && registration.developmentCodes?.[channel] && <p className="auth-success" role="status">Mã kiểm thử: <code>{registration.developmentCodes[channel]}</code></p>}<form className="auth-form" onSubmit={submit}><div className="field"><label htmlFor="verification-code">Mã xác thực</label><input id="verification-code" className="verification-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required /></div>{error && <p className="auth-alert" role="alert">{error}</p>}{resendMessage && <p className="auth-success">{resendMessage}</p>}<Button type="submit" size="lg" loading={loading}>Xác thực mã</Button></form><p className="auth-note">Chưa nhận được mã? <button type="button" className="auth-link" onClick={resend}>Gửi lại</button></p></div></div></AuthLayout>;
}
