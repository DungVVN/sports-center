import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ApiError } from "../../api/api-error.js";
import { Button } from "../../components/ui/Button.jsx";
import { authApi } from "./auth-api.js";
import { AuthLayout } from "./AuthLayout.jsx";

export function TotpVerificationPage({ challenge, onCompleted, onCancel, verifyLogin = authApi.verifyTotpLogin, portalName = "hệ thống" }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await verifyLogin({ challengeId: challenge.challengeId, code });
      const current = await authApi.me();
      onCompleted({ ...session, ...current });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Không thể xác thực Authenticator. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }
  return <AuthLayout><div className="auth-card"><ShieldCheck aria-hidden="true" size={28} /><h2>Xác thực Authenticator</h2><p className="auth-card__subtitle">Nhập mã 6 số từ ứng dụng Authenticator để hoàn tất đăng nhập {portalName}.</p><form className="auth-form" onSubmit={submit}><div className="field"><label htmlFor="totp-code">Mã xác thực</label><input autoComplete="one-time-code" id="totp-code" inputMode="numeric" maxLength="6" onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} pattern="\d{6}" required value={code} /></div>{error && <p className="auth-alert" role="alert">{error}</p>}<Button disabled={code.length !== 6} loading={loading} size="lg" type="submit">Xác thực</Button></form><button className="auth-link" onClick={onCancel} type="button">Quay lại đăng nhập</button></div></AuthLayout>;
}
