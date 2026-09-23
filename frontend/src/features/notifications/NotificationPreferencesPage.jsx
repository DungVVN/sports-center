import { useEffect, useState } from "react";
import { Bell, Mail } from "lucide-react";
import { Button } from "../../components/ui/Button.jsx";
import { apiClient } from "../../api/client.js";
import "../members/members.css";
import "./notification-preferences.css";

export function NotificationPreferencesPanel({ className = "" }) {
  const [value, setValue] = useState({ emailEnabled: true });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const data = await apiClient.get("/notification-preferences");
        if (active) setValue({ emailEnabled: data.email_enabled });
      } catch (caught) {
        if (active) setError(caught.message ?? "Không thể tải tùy chọn thông báo.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function save(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await apiClient.put("/notification-preferences", value);
      setNotice("Đã lưu tùy chọn thông báo thành công.");
    } catch (caught) {
      setError(caught.message ?? "Không thể lưu cài đặt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={`notification-preferences ${className}`.trim()}>
      {notice && <p className="profile-notice" role="status">{notice}</p>}
      {error && <p className="auth-alert" role="alert">{error}</p>}
      {loading ? (
        <p className="notification-preferences__loading">Đang tải tùy chọn thông báo…</p>
      ) : (
        <>
          <form className="members-form notification-preferences__form" onSubmit={save}>
            <div className="notification-preferences__heading">
              <div className="notification-preferences__icon">
                <Bell size={20} />
              </div>
              <div>
                <h2>Cài đặt kênh liên lạc</h2>
                <p>Tùy chỉnh cách bạn nhận thông tin từ trung tâm thể thao.</p>
              </div>
            </div>

            <div className="notification-preferences__choice">
              <input
                id="email-notif-toggle"
                checked={value.emailEnabled}
                onChange={(e) => setValue({ ...value, emailEnabled: e.target.checked })}
                type="checkbox"
              />
              <label htmlFor="email-notif-toggle">
                <span>
                  <Mail size={16} /> Nhận email vận hành & hỗ trợ
                </span>
                <small>
                  Nhận email nhắc lịch tập, xác nhận đặt chỗ, thông báo trạng thái hội viên và phản hồi hỗ trợ.
                </small>
              </label>
            </div>

            <p className="notification-preferences__note">
              * Email xác thực bảo mật và đổi mật khẩu vẫn được gửi tự động khi cần thiết.
            </p>

            <Button loading={submitting} type="submit">
              Lưu cài đặt
            </Button>
          </form>
        </>
      )}
    </section>
  );
}

export function NotificationPreferencesPage() {
  return (
    <main className="members-page">
      <header>
        <p>Thông báo</p>
        <h1>Tùy chọn thông báo</h1>
      </header>
      <NotificationPreferencesPanel />
    </main>
  );
}
