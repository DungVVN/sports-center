import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { ApiError } from "../../api/api-error.js";
import { Button } from "../../components/ui/Button.jsx";
import { authApi } from "./auth-api.js";
import { AuthLayout } from "./AuthLayout.jsx";

export function VerificationPage({ registration, onCompleted }) {
  const channel = "email";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authApi.confirmVerification({ userId: registration.userId, channel, code });
      setCode("");
      if (result.status === "pending_approval") onCompleted();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Không thể xác thực mã.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (cooldown > 0 || resending) return;
    setError("");
    setResending(true);
    try {
      await authApi.resendVerification({ userId: registration.userId, channel });
      setResendMessage("Đã gửi lại mã xác thực.");
      setCooldown(60);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Không thể gửi lại mã.");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-status-icon">
          <BadgeCheck size={25} aria-hidden="true" />
        </div>
        <h2>Xác thực email</h2>
        <p className="auth-card__subtitle">Nhập mã 6 số đã gửi đến email của bạn.</p>
        <div className="auth-form">
          {import.meta.env.DEV && registration.developmentCodes?.[channel] && (
            <p className="auth-success" role="status">
              Mã kiểm thử: <code>{registration.developmentCodes[channel]}</code>
            </p>
          )}
          <form className="auth-form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="verification-code">Mã xác thực</label>
              <input
                id="verification-code"
                className="verification-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            </div>
            {error && <p className="auth-alert" role="alert">{error}</p>}
            {resendMessage && <p className="auth-success">{resendMessage}</p>}
            <Button type="submit" size="lg" loading={loading}>
              Xác thực mã
            </Button>
          </form>
          <p className="auth-note">
            Chưa nhận được mã?{" "}
            <button
              type="button"
              className="auth-link"
              onClick={resend}
              disabled={cooldown > 0 || resending}
              style={cooldown > 0 || resending ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
            >
              {cooldown > 0 ? `Gửi lại sau (${cooldown}s)` : (resending ? "Đang gửi…" : "Gửi lại")}
            </button>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
