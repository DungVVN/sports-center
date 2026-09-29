import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { useMutationFeedback, useSubmitMutation } from "../../shared/lib/useMutationFeedback.js";
import { Button } from "../../shared/ui/Button.jsx";
import { authApi } from "./auth-api.js";
import { AuthLayout } from "./AuthLayout.jsx";

export function VerificationPage({ registration, onCompleted }) {
  const channel = "email";
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const feedback = useMutationFeedback();
  const verify = useSubmitMutation({ feedback, mutationFn: (input) => authApi.confirmVerification(input), onSuccess: (result) => { if (result.status === "pending_approval") onCompleted(); }, successMessage: "Đã xác thực email. Tài khoản đang chờ Lễ tân duyệt.", errorMessage: "Không thể xác thực mã." });
  const resendMutation = useSubmitMutation({ feedback, mutationFn: (input) => authApi.resendVerification(input), successMessage: "Đã gửi lại mã xác thực.", errorMessage: "Không thể gửi lại mã." });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function submit(event) {
    event.preventDefault();
    feedback.clear();
    try { await verify.mutateAsync({ userId: registration.userId, channel, code });
      setCode("");
    } catch { /* feedback is rendered below */ }
  }

  async function resend() {
    if (cooldown > 0 || resendMutation.isPending) return;
    feedback.clear();
    try { await resendMutation.mutateAsync({ userId: registration.userId, channel });
      setCooldown(60);
    } catch { /* feedback is rendered below */ }
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
            {feedback.error && <p className="auth-alert" role="alert">{feedback.error}</p>}
            {feedback.notice && <p className="auth-success">{feedback.notice}</p>}
            <Button type="submit" size="lg" loading={verify.isPending}>
              Xác thực mã
            </Button>
          </form>
          <p className="auth-note">
            Chưa nhận được mã?{" "}
            <button
              type="button"
              className="auth-link"
              onClick={resend}
              disabled={cooldown > 0 || resendMutation.isPending}
              style={cooldown > 0 || resendMutation.isPending ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
            >
              {cooldown > 0 ? `Gửi lại sau (${cooldown}s)` : (resendMutation.isPending ? "Đang gửi…" : "Gửi lại")}
            </button>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
