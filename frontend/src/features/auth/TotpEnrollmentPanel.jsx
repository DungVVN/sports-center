import { useEffect, useState } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { useMutationFeedback, useSubmitMutation } from "../../shared/lib/useMutationFeedback.js";
import { Button } from "../../shared/ui/Button.jsx";
import { authApi } from "./auth-api.js";
import { useToast } from "../../shared/ui/useToast.js";

export function TotpEnrollmentPanel({ onEnrollmentCompleted }) {
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const feedback = useMutationFeedback();
  const showToast = useToast();
  const beginEnrollment = useSubmitMutation({ feedback, mutationFn: authApi.beginTotpEnrollment, successMessage: "Đã tạo mã thiết lập Authenticator. Nhập mã 6 số để hoàn tất.", errorMessage: "Không thể bắt đầu đăng ký Authenticator." });
  const confirmEnrollment = useSubmitMutation({ feedback, mutationFn: (input) => authApi.confirmTotpEnrollment(input), onSuccess: () => { setEnrollment(null); setCode(""); onEnrollmentCompleted?.(); }, successMessage: "Authenticator đã được kích hoạt. Lần đăng nhập tiếp theo sẽ yêu cầu mã 6 số.", errorMessage: "Không thể xác nhận Authenticator." });
  async function begin() {
    try { setEnrollment(await beginEnrollment.mutateAsync()); } catch { /* feedback is rendered below */ }
  }

  async function confirm(event) {
    event.preventDefault();
    await confirmEnrollment.mutateAsync({ enrollmentId: enrollment.enrollmentId, code }).catch(() => {});
  }

  async function copySecret() {
    if (!enrollment?.secret) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopiedSecret(true);
      showToast?.("Đã sao chép khóa Authenticator.", "success");
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      showToast?.("Không thể sao chép khóa Authenticator. Vui lòng sao chép thủ công từ ô đang hiển thị.", "error");
    }
  }

  return (
    <section className={`members-list profile-page__mfa${enrollment ? " profile-page__mfa--expanded" : ""}`}>
      <div className="list-heading">
        <div>
          <h2>Authenticator</h2>
          <p>Sau khi thiết lập, bạn sẽ dùng mã 6 số từ ứng dụng Authenticator khi đăng nhập.</p>
        </div>
      </div>
      {feedback.notice && <p className="profile-notice" role="status">{feedback.notice}</p>}
      {feedback.error && <p className="auth-alert" role="alert">{feedback.error}</p>}
      {!enrollment ? (
        <Button loading={beginEnrollment.isPending} onClick={begin} type="button">
          <ShieldCheck aria-hidden="true" size={16} />Thiết lập Authenticator
        </Button>
      ) : (
        <form className="members-form profile-page__mfa-form" onSubmit={confirm}>
          <div className={`profile-page__mfa-enrollment${enrollment.otpauthUri ? "" : " profile-page__mfa-enrollment--manual"}`}>
            {enrollment.otpauthUri && (
              <section className="profile-page__mfa-qr" aria-label="Mã QR thiết lập Authenticator">
                <h3>Quét mã QR</h3>
                <TotpQrCode key={enrollment.otpauthUri} otpauthUri={enrollment.otpauthUri} />
                <p>Mở Authenticator, chọn thêm tài khoản rồi quét mã này.</p>
              </section>
            )}
            <div className="profile-page__mfa-manual">
              <p>Nếu không quét được, chọn nhập khóa thiết lập thủ công trong ứng dụng Authenticator. Không chia sẻ khóa này.</p>
              <label>
                Khóa thiết lập
                <div className="profile-page__mfa-secret">
                  <input aria-label="Khóa thiết lập Authenticator" readOnly value={enrollment.secret} />
                  <Button onClick={copySecret} size="sm" type="button" variant="outline">
                    {copiedSecret ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    {copiedSecret ? "Đã sao chép!" : "Sao chép"}
                  </Button>
                </div>
              </label>
            </div>
          </div>
          <label>
            Mã 6 số
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength="6"
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              pattern="\d{6}"
              required
              value={code}
            />
          </label>
          <div className="profile-page__actions">
            <Button disabled={code.length !== 6} loading={confirmEnrollment.isPending} type="submit">
              Xác nhận Authenticator
            </Button>
            <Button onClick={() => { setEnrollment(null); setCode(""); }} type="button" variant="ghost">
              Hủy
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function TotpQrCode({ otpauthUri }) {
  const [qrCodeSrc, setQrCodeSrc] = useState("");
  const [qrCodeError, setQrCodeError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(otpauthUri, {
      color: { dark: "#122b45", light: "#ffffff" },
      errorCorrectionLevel: "M",
      margin: 1,
      width: 216,
    })
      .then((value) => {
        if (!cancelled) setQrCodeSrc(value);
      })
      .catch(() => {
        if (!cancelled) setQrCodeError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [otpauthUri]);

  if (qrCodeSrc) return <img alt="Mã QR thiết lập Authenticator" src={qrCodeSrc} />;

  return (
    <div aria-live="polite" className="profile-page__mfa-qr-placeholder">
      {qrCodeError ? "Không thể tạo mã QR." : "Đang tạo mã QR…"}
    </div>
  );
}
