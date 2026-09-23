import { useEffect, useState } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { ApiError } from "../../api/api-error.js";
import { Button } from "../../components/ui/Button.jsx";
import { authApi } from "./auth-api.js";

export function TotpEnrollmentPanel({ onEnrollmentCompleted }) {
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrCodeSrc, setQrCodeSrc] = useState("");
  const [qrCodeError, setQrCodeError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setQrCodeSrc("");
    setQrCodeError(false);
    if (!enrollment?.otpauthUri) return undefined;

    QRCode.toDataURL(enrollment.otpauthUri, {
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
  }, [enrollment?.otpauthUri]);

  async function begin() {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      setEnrollment(await authApi.beginTotpEnrollment());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Không thể bắt đầu đăng ký Authenticator.");
    } finally {
      setLoading(false);
    }
  }

  async function confirm(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.confirmTotpEnrollment({ enrollmentId: enrollment.enrollmentId, code });
      setEnrollment(null);
      setCode("");
      setNotice("Authenticator đã được kích hoạt. Lần đăng nhập Manager tiếp theo sẽ yêu cầu mã 6 số.");
      onEnrollmentCompleted?.();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Không thể xác nhận Authenticator.");
    } finally {
      setLoading(false);
    }
  }

  function copySecret() {
    if (!enrollment?.secret) return;
    navigator.clipboard.writeText(enrollment.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  }

  return (
    <section className="members-list profile-page__mfa">
      <div className="list-heading">
        <div>
          <h2>Authenticator</h2>
          <p>Manager dùng mã 6 số từ ứng dụng Authenticator khi đăng nhập.</p>
        </div>
      </div>
      {notice && <p className="profile-notice" role="status">{notice}</p>}
      {error && <p className="auth-alert" role="alert">{error}</p>}
      {!enrollment ? (
        <Button loading={loading} onClick={begin} type="button">
          <ShieldCheck aria-hidden="true" size={16} />Thiết lập Authenticator
        </Button>
      ) : (
        <form className="members-form profile-page__mfa-form" onSubmit={confirm}>
          <div className={`profile-page__mfa-enrollment${enrollment.otpauthUri ? "" : " profile-page__mfa-enrollment--manual"}`}>
            {enrollment.otpauthUri && (
              <section className="profile-page__mfa-qr" aria-label="Mã QR thiết lập Authenticator">
                <h3>Quét mã QR</h3>
                {qrCodeSrc ? (
                  <img alt="Mã QR thiết lập Authenticator" src={qrCodeSrc} />
                ) : (
                  <div aria-live="polite" className="profile-page__mfa-qr-placeholder">
                    {qrCodeError ? "Không thể tạo mã QR." : "Đang tạo mã QR…"}
                  </div>
                )}
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
            <Button disabled={code.length !== 6} loading={loading} type="submit">
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
