import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "../../../shared/ui/Button.jsx";
import { TotpEnrollmentPanel } from "./TotpEnrollmentPanel.jsx";
import { NotificationPreferencesPanel } from "../../notifications/index.js";
import { hasSessionPermission } from "../domain/session-permissions.js";
import { useProfileWorkspace } from "../api/useProfileWorkspace.js";
import "./profile.css";

const roleLabels = {
  admin: "Quản trị hệ thống",
  manager: "Quản lý trung tâm",
  receptionist: "Lễ tân",
  coach: "Huấn luyện viên",
  member: "Hội viên",
};
const statusLabels = { active: "Đang hoạt động", suspended: "Đình chỉ" };
const emptyContact = {
  fullName: "",
  relationship: "",
  phone: "",
  isPrimary: false,
};

function toForm(profile) {
  return {
    fullName: profile.fullName ?? "",
    phone: profile.phone ?? "",
    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "",
    avatarUrl: profile.avatarUrl ?? "",
    gender: profile.gender ?? "",
    contacts: profile.contacts ?? [],
  };
}

export function ProfileAvatar({ src, alt, fallback }) {
  const [failed, setFailed] = useState(false);
  return !src || failed ? fallback : <img alt={alt} onError={() => setFailed(true)} src={src} />;
}

export function ProfilePage({ onSessionRevoked, onProfileSaved, session }) {
  const workspace = useProfileWorkspace({ onProfileSaved });
  const profile = workspace.profile;
  const [formDraft, setFormDraft] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = profile ? formDraft ?? toForm(profile) : null;

  function updateField(name, value) {
    setFormDraft((current) => ({ ...(current ?? toForm(profile)), [name]: value }));
  }

  function updateContact(index, field, value) {
    setFormDraft((current) => ({
      ...(current ?? toForm(profile)),
      contacts: (current ?? toForm(profile)).contacts.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, [field]: value } : contact,
      ),
    }));
  }

  function choosePrimary(index) {
    setFormDraft((current) => ({
      ...(current ?? toForm(profile)),
      contacts: (current ?? toForm(profile)).contacts.map((contact, contactIndex) => ({
        ...contact,
        isPrimary: contactIndex === index,
      })),
    }));
  }

  async function submit(event) {
    event.preventDefault();
    workspace.clearFeedback();
    if (!form.fullName.trim() || !form.phone.trim()) {
      workspace.setError("Vui lòng nhập họ tên và số điện thoại.");
      return;
    }
    if (
      profile.role === "member" &&
      form.contacts.filter((item) => item.isPrimary).length > 1
    ) {
      workspace.setError("Chỉ được chọn một liên hệ khẩn cấp chính.");
      return;
    }
    try {
      await workspace.saveProfile.mutateAsync({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        dateOfBirth: form.dateOfBirth || null,
        avatarUrl: form.avatarUrl.trim() || null,
        ...(profile.role === "member"
          ? { gender: form.gender || null, contacts: form.contacts }
          : {}),
      });
      setFormDraft(null);
    } catch { /* feedback is rendered below */ }
  }

  async function changePassword(event) {
    event.preventDefault();
    workspace.clearFeedback();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      workspace.setError("Xác nhận mật khẩu mới không khớp.");
      return;
    }
    try {
      await workspace.changePassword.mutateAsync({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch { /* feedback is rendered below */ }
  }

  if (workspace.loading)
    return (
      <main className="members-page">
        <p>Đang tải hồ sơ cá nhân…</p>
      </main>
    );
  if (!profile || !form)
    return (
      <main className="members-page">
        <p className="auth-alert" role="alert">
          {workspace.error || "Không thể tải hồ sơ cá nhân."}
        </p>
        <Button onClick={workspace.reload}>Thử lại</Button>
      </main>
    );

  const isMember = profile.role === "member";
  return (
    <main className="members-page profile-page">
      <header>
        <p>Hồ sơ</p>
        <h1>Hồ sơ cá nhân</h1>
      </header>
      {workspace.error && (
        <p className="auth-alert" role="alert">
          {workspace.error}
        </p>
      )}
      {workspace.notice && (
        <p className="profile-notice" role="status">
          {workspace.notice}
        </p>
      )}
      <section className="profile-page__grid">
        <div className="profile-page__main-col">
          <form className="members-form profile-page__form" onSubmit={submit}>
            <div className="list-heading">
              <h2>Thông tin cá nhân</h2>
              <Button onClick={workspace.reload} size="sm" type="button" variant="ghost">
                Tải lại
              </Button>
            </div>
            <div className="profile-page__identity">
              <div>
                <span>{isMember ? "Mã hội viên" : "Mã nhân viên"}</span>
                <code>
                  {isMember ? profile.memberCode : profile.employeeCode}
                </code>
              </div>
              <div>
                <span>Vai trò</span>
                <strong>{roleLabels[profile.role] ?? profile.role}</strong>
              </div>
              <div>
                <span>Trạng thái</span>
                <strong
                  className={
                    profile.status === "active"
                      ? "profile-status profile-status--active"
                      : "profile-status profile-status--suspended"
                  }
                >
                  {statusLabels[profile.status] ?? profile.status}
                </strong>
              </div>
            </div>
            <div className="profile-page__fields">
              <label>
                Họ tên
                <input
                  maxLength="120"
                  onChange={(event) =>
                    updateField("fullName", event.target.value)
                  }
                  required
                  value={form.fullName}
                />
              </label>
              <label>
                Email
                <input disabled value={profile.email} />
                <small>Email được quản lý bởi hệ thống.</small>
              </label>
              <label>
                Số điện thoại
                <input
                  inputMode="tel"
                  maxLength="20"
                  onChange={(event) => updateField("phone", event.target.value)}
                  required
                  value={form.phone}
                />
              </label>
              <label>
                Ngày sinh
                <input
                  onChange={(event) =>
                    updateField("dateOfBirth", event.target.value)
                  }
                  type="date"
                  value={form.dateOfBirth}
                />
              </label>
              <label className="profile-page__avatar-field">
                Ảnh đại diện
                <input
                  onChange={(event) => updateField("avatarUrl", event.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  type="url"
                  value={form.avatarUrl}
                />
                {form.avatarUrl && (
                  <ProfileAvatar
                    key={form.avatarUrl}
                    alt="Xem trước ảnh đại diện"
                    fallback={<span className="profile-page__avatar-error" role="status">Không tải được ảnh từ đường dẫn này.</span>}
                    src={form.avatarUrl}
                  />
                )}
                <small>Nhập đường dẫn HTTPS của ảnh.</small>
              </label>
              {isMember && (
                <label>
                  Giới tính
                  <select
                    onChange={(event) =>
                      updateField("gender", event.target.value)
                    }
                    value={form.gender}
                  >
                    <option value="">Chưa cập nhật</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </label>
              )}
            </div>
            <div className="profile-page__actions">
              <Button loading={workspace.saveProfile.isPending} type="submit">
                Lưu thay đổi
              </Button>
              <span>Email, vai trò và trạng thái chỉ có thể xem.</span>
            </div>
          </form>

          <div className="profile-page__security-group">
            <form className="members-form profile-page__form profile-page__password-form" onSubmit={changePassword}>
            <div className="list-heading">
              <div>
                <h2>Đổi mật khẩu</h2>
                <p id="profile-new-password-hint">Mật khẩu mới cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.</p>
              </div>
            </div>
            <div className="profile-page__fields">
              <label>
                Mật khẩu hiện tại
                <div className="password-input-wrapper">
                  <input
                    aria-label="Mật khẩu hiện tại"
                    autoComplete="current-password"
                    minLength="8"
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        currentPassword: event.target.value,
                      }))
                    }
                    required
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordForm.currentPassword}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    aria-label={showCurrentPassword ? "Ẩn mật khẩu hiện tại" : "Hiện mật khẩu hiện tại"}
                  >
                    {showCurrentPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
              </label>
              <label>
                Mật khẩu mới
                <div className="password-input-wrapper">
                  <input
                    aria-label="Mật khẩu mới"
                    aria-describedby="profile-new-password-hint"
                    autoComplete="new-password"
                    minLength="8"
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        newPassword: event.target.value,
                      }))
                    }
                    required
                    type={showNewPassword ? "text" : "password"}
                    value={passwordForm.newPassword}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label={showNewPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
                  >
                    {showNewPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
              </label>
              <label>
                Xác nhận mật khẩu mới
                <div className="password-input-wrapper">
                  <input
                    aria-label="Xác nhận mật khẩu mới"
                    autoComplete="new-password"
                    minLength="8"
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                    required
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Ẩn xác nhận mật khẩu" : "Hiện xác nhận mật khẩu"}
                  >
                    {showConfirmPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
              </label>
            </div>
            <div className="profile-page__actions">
              <Button loading={workspace.changePassword.isPending} type="submit">
                Đổi mật khẩu
              </Button>
              <span>Mọi phiên đăng nhập hiện có sẽ được thu hồi.</span>
            </div>
          </form>

          {hasSessionPermission(session, "notification.preference.manage") && (
            <NotificationPreferencesPanel className="profile-page__notifications" />
          )}
          </div>
        </div>

        <div className="profile-page__side-col">
          {isMember && (
            <section className="members-list profile-page__contacts">
              <div className="list-heading">
                <h2>Liên hệ khẩn cấp</h2>
                <Button
                  disabled={form.contacts.length >= 3}
                  onClick={() =>
                    setFormDraft((current) => ({
                      ...(current ?? toForm(profile)),
                      contacts: [
                        ...(current ?? toForm(profile)).contacts,
                        {
                          ...emptyContact,
                          isPrimary: (current ?? toForm(profile)).contacts.length === 0,
                        },
                      ],
                    }))
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Thêm liên hệ
                </Button>
              </div>
              {form.contacts.length === 0 ? (
                <p className="profile-page__empty">
                  Chưa có liên hệ khẩn cấp. Bạn có thể thêm tối đa ba người liên hệ.
                </p>
              ) : (
                <div className="profile-page__contact-list">
                  {form.contacts.map((contact, index) => (
                    <fieldset key={contact.id ?? `new-${index}`}>
                      <legend>Liên hệ {index + 1}</legend>
                      <label>
                        Họ tên
                        <input
                          onChange={(event) =>
                            updateContact(index, "fullName", event.target.value)
                          }
                          required
                          value={contact.fullName}
                        />
                      </label>
                      <label>
                        Mối quan hệ
                        <input
                          onChange={(event) =>
                            updateContact(
                              index,
                              "relationship",
                              event.target.value,
                            )
                          }
                          required
                          value={contact.relationship}
                        />
                      </label>
                      <label>
                        Số điện thoại
                        <input
                          inputMode="tel"
                          onChange={(event) =>
                            updateContact(index, "phone", event.target.value)
                          }
                          required
                          value={contact.phone}
                        />
                      </label>
                      <label className="profile-page__primary">
                        <input
                          checked={contact.isPrimary}
                          name="primary-contact"
                          onChange={() => choosePrimary(index)}
                          type="radio"
                        />
                        Liên hệ chính
                      </label>
                      <Button
                        onClick={() =>
                          setFormDraft((current) => ({
                            ...(current ?? toForm(profile)),
                            contacts: (current ?? toForm(profile)).contacts
                              .filter((_, contactIndex) => contactIndex !== index)
                              .map((item, contactIndex) => ({
                                ...item,
                                isPrimary:
                                  contactIndex === 0 &&
                                  !(current ?? toForm(profile)).contacts
                                    .filter((_, i) => i !== index)
                                    .some((entry) => entry.isPrimary),
                              })),
                          }))
                        }
                        size="sm"
                        type="button"
                        variant="danger"
                      >
                        Xóa
                      </Button>
                    </fieldset>
                  ))}
                </div>
              )}
            </section>
          )}

          {!isMember && (
            <aside className="members-list profile-page__summary">
              <div className="profile-page__summary-hero">
                <ProfileAvatar
                  key={profile.avatarUrl ?? "no-avatar"}
                  alt={`Ảnh đại diện ${profile.fullName}`}
                  src={profile.avatarUrl}
                  fallback={
                    <span aria-hidden="true">
                      {profile.fullName.trim().split(/\s+/).slice(-2).map((item) => item[0]).join("")}
                    </span>
                  }
                />
                <div>
                  <p>Hồ sơ nhân sự</p>
                  <h2>{profile.fullName}</h2>
                  <small>{roleLabels[profile.role] ?? profile.role}</small>
                </div>
              </div>
              <dl className="profile-page__summary-list">
                <div>
                  <dt>Mã nhân viên</dt>
                  <dd><code>{profile.employeeCode ?? "Chưa cập nhật"}</code></dd>
                </div>
                <div>
                  <dt>Ngày vào làm</dt>
                  <dd>
                    {profile.hiredAt
                      ? new Date(profile.hiredAt).toLocaleDateString("vi-VN")
                      : "Chưa cập nhật"}
                  </dd>
                </div>
                <div>
                  <dt>Trạng thái tài khoản</dt>
                  <dd
                    className={
                      profile.status === "active"
                        ? "profile-status profile-status--active"
                        : "profile-status profile-status--suspended"
                    }
                  >
                    {statusLabels[profile.status] ?? profile.status}
                  </dd>
                </div>
              </dl>
              <section className="profile-page__specialties">
                <h3>Chuyên môn</h3>
                {profile.specialties?.length ? (
                  <ul>
                    {profile.specialties.map((specialty) => (
                      <li key={specialty}>{specialty}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Chưa có chuyên môn được cập nhật trong hồ sơ.</p>
                )}
              </section>
              <p className="profile-page__summary-note">
                Thông tin công việc được quản lý bởi trung tâm. Liên hệ Quản lý nếu cần điều chỉnh.
              </p>
            </aside>
          )}

          <TotpEnrollmentPanel onEnrollmentCompleted={onSessionRevoked} />
        </div>
      </section>
    </main>
  );
}
