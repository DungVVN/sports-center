import { ProfileAvatar } from "./ProfileAvatar.jsx";
import { roleLabels, statusLabels } from "../domain/profile-form.js";
import { Button } from "../../../shared/ui/Button.jsx";
export function ProfileDetailsForm({
  avatarUploading,
  form,
  isMember,
  profile,
  submit,
  updateField,
  uploadAvatar,
  workspace,
}) {
  return (
    <form className="members-form profile-page__form" onSubmit={submit}>
      <div className="list-heading">
        <h2>Thông tin cá nhân</h2>
        <Button
          onClick={workspace.reload}
          size="sm"
          type="button"
          variant="ghost"
        >
          Tải lại
        </Button>
      </div>
      <div className="profile-page__identity">
        <div>
          <span>{isMember ? "Mã hội viên" : "Mã nhân viên"}</span>
          <code>{isMember ? profile.memberCode : profile.employeeCode}</code>
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
            onChange={(event) => updateField("fullName", event.target.value)}
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
            onChange={(event) => updateField("dateOfBirth", event.target.value)}
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
          <input
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            disabled={avatarUploading}
            onChange={uploadAvatar}
            type="file"
          />
          {form.avatarUrl && (
            <ProfileAvatar
              key={form.avatarUrl}
              alt="Xem trước ảnh đại diện"
              fallback={
                <span className="profile-page__avatar-error" role="status">
                  Không tải được ảnh từ đường dẫn này.
                </span>
              }
              src={form.avatarUrl}
            />
          )}
          <small>
            Nhập URL HTTPS hoặc chọn ảnh từ máy (JPG, PNG, WebP, GIF, AVIF; tối
            đa 10 MB){avatarUploading ? " · Đang tải..." : ""}. Bấm Lưu thay đổi
            để cập nhật hồ sơ.
          </small>
        </label>
        {isMember && (
          <label>
            Giới tính
            <select
              onChange={(event) => updateField("gender", event.target.value)}
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
  );
}
