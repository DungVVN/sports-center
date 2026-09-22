import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ApiError } from "../../api/api-error.js";
import { Button } from "../../components/ui/Button.jsx";
import { authApi } from "./auth-api.js";

export function TotpEnrollmentPanel({ onEnrollmentCompleted }) {
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

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

  return <section className="members-list profile-page__mfa">
    <div className="list-heading"><div><h2>Authenticator</h2><p>Manager dùng mã 6 số từ ứng dụng Authenticator khi đăng nhập.</p></div></div>
    {notice && <p className="profile-notice" role="status">{notice}</p>}
    {error && <p className="auth-alert" role="alert">{error}</p>}
    {!enrollment ? <Button loading={loading} onClick={begin} type="button"><ShieldCheck aria-hidden="true" size={16} />Thiết lập Authenticator</Button> : <form className="members-form profile-page__mfa-form" onSubmit={confirm}>
      <p>Trong ứng dụng Authenticator, chọn nhập khóa thiết lập thủ công và dùng khóa bên dưới. Không chia sẻ khóa này.</p>
      <label>Khóa thiết lập<input aria-label="Khóa thiết lập Authenticator" readOnly value={enrollment.secret} /></label>
      <label>Mã 6 số<input autoComplete="one-time-code" inputMode="numeric" maxLength="6" onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} pattern="\d{6}" required value={code} /></label>
      <div className="profile-page__actions"><Button disabled={code.length !== 6} loading={loading} type="submit">Xác nhận Authenticator</Button><Button onClick={() => { setEnrollment(null); setCode(""); }} type="button" variant="ghost">Hủy</Button></div>
    </form>}
  </section>;
}
