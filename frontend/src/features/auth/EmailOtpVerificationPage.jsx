import { useState } from "react";
import { MailCheck } from "lucide-react";
import { errorMessageFor } from "../../shared/api/error-message.js";
import { useToast } from "../../shared/ui/useToast.js";
import { Button } from "../../shared/ui/Button.jsx";
import { authApi } from "./auth-api.js";
import { AuthLayout } from "./AuthLayout.jsx";

export function EmailOtpVerificationPage({ challenge, onCompleted, onCancel }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const showToast = useToast();
  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await authApi.verifyStaffEmailOtp({ challengeId: challenge.challengeId, code });
      const current = await authApi.me();
      showToast?.("Xác thực email và đăng nhập thành công.", "success");
      onCompleted({ ...session, ...current });
    } catch (caught) {
      const message = errorMessageFor(caught, "Không thể xác thực mã email.");
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
          <MailCheck aria-hidden="true" size={24} />
        </div>
        <h2>Xác thực email</h2>
        <p className="auth-card__subtitle">
          Chúng tôi đã gửi mã đăng nhập 6 số đến email của bạn. Mã có hiệu lực trong thời gian ngắn.
        </p>
        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="staff-email-otp">Mã đăng nhập</label>
            <input
              autoComplete="one-time-code"
              className="verification-code"
              id="staff-email-otp"
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
            Xác thực và đăng nhập
          </Button>
        </form>
        <button className="auth-link" onClick={onCancel} type="button">
          Quay lại đăng nhập
        </button>
      </div>
    </AuthLayout>
  );
}
