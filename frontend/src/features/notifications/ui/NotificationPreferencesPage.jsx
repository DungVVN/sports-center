import { PageHeader } from "../../../shared/ui/PageHeader.jsx";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutationFeedback, useSubmitMutation } from "../../../shared/lib/useMutationFeedback.js";
import { Bell, Mail } from "lucide-react";
import { Button } from "../../../shared/ui/Button.jsx";
import { apiClient } from "../../../shared/api/client.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import "./notification-preferences.css";

export function NotificationPreferencesPanel({ className = "" }) {
  const preferencesQuery = useQuery({ queryKey: ["notification-preferences"], queryFn: () => apiClient.get("/notification-preferences") });
  const feedback = useMutationFeedback();
  const [draft, setDraft] = useState(null);
  const value = draft ?? { emailEnabled: preferencesQuery.data?.email_enabled ?? true };
  const savePreferences = useSubmitMutation({ feedback, mutationFn: (input) => apiClient.put("/notification-preferences", input), onSuccess: async () => { setDraft(null); await preferencesQuery.refetch(); }, successMessage: "Đã lưu tùy chọn thông báo thành công.", errorMessage: "Không thể lưu cài đặt." });

  async function save(e) {
    e.preventDefault();
    await savePreferences.mutateAsync(value).catch(() => {});
  }

  return (
    <section className={`notification-preferences ${className}`.trim()}>
      {feedback.notice && <p className="profile-notice" role="status">{feedback.notice}</p>}
      {(feedback.error || preferencesQuery.isError) && <p className="auth-alert" role="alert">{feedback.error || errorMessageFor(preferencesQuery.error, "Không thể tải tùy chọn thông báo.")}</p>}
      {preferencesQuery.isLoading ? (
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
                onChange={(e) => setDraft({ ...value, emailEnabled: e.target.checked })}
                type="checkbox"
              />
              <label htmlFor="email-notif-toggle">
                <span>
                  <Mail size={16} /> Nhận email quan trọng
                </span>
                <small>
                  Email cho thanh toán, hoàn tiền, lịch tập, quyền sử dụng gói và phản hồi hỗ trợ. Các thao tác cập nhật thường chỉ hiển thị ở chuông thông báo.
                </small>
              </label>
            </div>

            <p className="notification-preferences__note">
              * Email xác thực bảo mật và đổi mật khẩu vẫn được gửi tự động khi cần thiết.
            </p>

            <Button loading={savePreferences.isPending} type="submit">
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
      <PageHeader eyebrow="Thông báo" title="Tùy chọn thông báo" />
      <NotificationPreferencesPanel />
    </main>
  );
}
