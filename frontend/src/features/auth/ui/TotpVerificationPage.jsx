import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { useToast } from "../../../shared/ui/useToast.js";
import { Button } from "../../../shared/ui/Button.jsx";
import { authApi } from "../api/auth-api.js";
import { AuthLayout } from "./AuthLayout.jsx";

export function TotpVerificationPage({ challenge, onCompleted, onCancel, verifyLogin = authApi.verifyTotpLogin, portalName = "hệ thống" }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const showToast = useToast();
  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await verifyLogin({ challengeId: challenge.challengeId, code });
      const current = await authApi.me();
      showToast?.("Xác thực Authenticator và đăng nhập thành công.", "success");
      onCompleted({ ...session, ...current });
    } catch (caught) {
      const message = errorMessageFor(caught, "Không thể xác thực Authenticator.");
      setError(message);
      showToast?.(message, "error");
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-status-icon">
          <ShieldCheck aria-hidden="true" size={24} />
        </div>
        <h2>Xác thực Authenticator</h2>
        <p className="auth-card__subtitle">
          Nhập mã 6 số từ ứng dụng Authenticator để hoàn tất đăng nhập {portalName}.
        </p>
        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="totp-code">Mã xác thực</label>
            <input
              autoComplete="one-time-code"
              className="verification-code"
              id="totp-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              pattern="\d{6}"
              placeholder="000000"
              required
              value={code}
            />
          </div>
          {error && <p className="auth-alert" role="alert">{error}</p>}
          <Button disabled={code.length !== 6} loading={loading} size="lg" type="submit">
            Xác thực
          </Button>
        </form>
        <button className="auth-link" onClick={onCancel} type="button">
          Quay lại đăng nhập
        </button>
      </div>
    </AuthLayout>
  );
}
