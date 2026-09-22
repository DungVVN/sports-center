import { useEffect, useState } from "react";
import { Bell, Mail } from "lucide-react";
import { Button } from "../../components/ui/Button.jsx";
import { apiClient } from "../../api/client.js";
import "../members/members.css";

export function NotificationPreferencesPage() {
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
    <main className="members-page">
      <header>
        <p>Thông báo</p>
        <h1>Tùy chọn thông báo</h1>
      </header>
      {notice && <p className="profile-notice" role="status">{notice}</p>}
      {error && <p className="auth-alert" role="alert">{error}</p>}
      {loading ? (
        <p>Đang tải tùy chọn thông báo…</p>
      ) : (
        <div style={{ maxWidth: "580px" }}>
          <form className="members-form" onSubmit={save}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-control)",
                  backgroundColor: "rgba(37, 99, 235, 0.1)",
                  color: "var(--color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Bell size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "16px" }}>Cài đặt kênh liên lạc</h2>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-secondary)" }}>
                  Tùy chỉnh cách bạn nhận thông tin từ trung tâm thể thao
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
                padding: "16px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-control)",
                backgroundColor: "var(--color-surface-hover)",
              }}
            >
              <input
                id="email-notif-toggle"
                checked={value.emailEnabled}
                onChange={(e) => setValue({ ...value, emailEnabled: e.target.checked })}
                type="checkbox"
                style={{ width: "18px", height: "18px", marginTop: "2px", cursor: "pointer" }}
              />
              <label htmlFor="email-notif-toggle" style={{ cursor: "pointer", display: "grid", gap: "4px" }}>
                <span style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Mail size={16} /> Nhận email vận hành & hỗ trợ
                </span>
                <span style={{ color: "var(--color-text-secondary)", fontSize: "13px", fontWeight: "normal" }}>
                  Nhận email nhắc lịch tập, xác nhận đặt chỗ, thông báo trạng thái hội viên và phản hồi hỗ trợ.
                </span>
              </label>
            </div>

            <p style={{ color: "var(--color-text-secondary)", fontSize: "12px", margin: "2px 0 6px" }}>
              * Email xác thực bảo mật và đổi mật khẩu vẫn được gửi tự động khi cần thiết.
            </p>

            <Button loading={submitting} type="submit" style={{ justifySelf: "start" }}>
              Lưu cài đặt
            </Button>
          </form>
        </div>
      )}
    </main>
  );
}
