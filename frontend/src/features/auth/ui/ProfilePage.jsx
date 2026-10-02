import { PageHeader } from "../../../shared/ui/PageHeader.jsx";
export { ProfileAvatar } from "./ProfileAvatar.jsx";
import { toForm } from "../domain/profile-form.js";
import { ProfileDetailsForm } from "./ProfileDetailsForm.jsx";
import { ProfilePasswordForm } from "./ProfilePasswordForm.jsx";
import { ProfileContacts } from "./ProfileContacts.jsx";
import { ProfileSummary } from "./ProfileSummary.jsx";
import { useState } from "react";
import { Button } from "../../../shared/ui/Button.jsx";
import { TotpEnrollmentPanel } from "./TotpEnrollmentPanel.jsx";
import { NotificationPreferencesPanel } from "../../notifications/index.js";
import { hasSessionPermission } from "../domain/session-permissions.js";
import { useProfileWorkspace } from "../api/useProfileWorkspace.js";
import { uploadProfileAvatar } from "../api/cloudinary-profile-upload.js";
import "./profile.css";
export function ProfilePage({ onSessionRevoked, onProfileSaved, session }) {
  const workspace = useProfileWorkspace({
    onProfileSaved,
  });
  const profile = workspace.profile;
  const [formDraft, setFormDraft] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const form = profile ? (formDraft ?? toForm(profile)) : null;
  function updateField(name, value) {
    setFormDraft((current) => ({
      ...(current ?? toForm(profile)),
      [name]: value,
    }));
  }
  function updateContact(index, field, value) {
    setFormDraft((current) => ({
      ...(current ?? toForm(profile)),
      contacts: (current ?? toForm(profile)).contacts.map(
        (contact, contactIndex) =>
          contactIndex === index
            ? {
                ...contact,
                [field]: value,
              }
            : contact,
      ),
    }));
  }
  function choosePrimary(index) {
    setFormDraft((current) => ({
      ...(current ?? toForm(profile)),
      contacts: (current ?? toForm(profile)).contacts.map(
        (contact, contactIndex) => ({
          ...contact,
          isPrimary: contactIndex === index,
        }),
      ),
    }));
  }
  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarUploading(true);
    workspace.clearFeedback();
    try {
      const url = await uploadProfileAvatar(file);
      updateField("avatarUrl", url);
      return url;
    } catch (cause) {
      workspace.setError(cause?.message || "Không thể tải ảnh đại diện lên.");
    } finally {
      setAvatarUploading(false);
    }
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
          ? {
              gender: form.gender || null,
              contacts: form.contacts,
            }
          : {}),
      });
      setFormDraft(null);
    } catch {
      /* feedback is rendered below */
    }
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
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch {
      /* feedback is rendered below */
    }
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
      <PageHeader eyebrow="Hồ sơ" title="Hồ sơ cá nhân" />
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
          <ProfileDetailsForm
            avatarUploading={avatarUploading}
            form={form}
            isMember={isMember}
            profile={profile}
            submit={submit}
            updateField={updateField}
            uploadAvatar={uploadAvatar}
            workspace={workspace}
          />

          <div className="profile-page__security-group">
            <ProfilePasswordForm
              changePassword={changePassword}
              passwordForm={passwordForm}
              setPasswordForm={setPasswordForm}
              workspace={workspace}
            />

          </div>
          {hasSessionPermission(session, "notification.preference.manage") && (
            <NotificationPreferencesPanel className="profile-page__notifications" />
          )}
        </div>

        <div className="profile-page__side-col">
          {isMember && (
            <ProfileContacts
              choosePrimary={choosePrimary}
              form={form}
              profile={profile}
              setFormDraft={setFormDraft}
              updateContact={updateContact}
            />
          )}

          {!isMember && <ProfileSummary profile={profile} />}

          <TotpEnrollmentPanel onEnrollmentCompleted={onSessionRevoked} />
        </div>
      </section>
    </main>
  );
}
