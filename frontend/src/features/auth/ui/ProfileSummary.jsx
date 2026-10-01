import { ProfileAvatar } from "./ProfileAvatar.jsx";
import { roleLabels, statusLabels } from "../domain/profile-form.js";
export function ProfileSummary({ profile }) {
  return (
    <aside className="members-list profile-page__summary">
      <div className="profile-page__summary-hero">
        <ProfileAvatar
          key={profile.avatarUrl ?? "no-avatar"}
          alt={`Ảnh đại diện ${profile.fullName}`}
          src={profile.avatarUrl}
          fallback={
            <span aria-hidden="true">
              {profile.fullName
                .trim()
                .split(/\s+/)
                .slice(-2)
                .map((item) => item[0])
                .join("")}
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
          <dd>
            <code>{profile.employeeCode ?? "Chưa cập nhật"}</code>
          </dd>
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
        Thông tin công việc được quản lý bởi trung tâm. Liên hệ Quản lý nếu cần
        điều chỉnh.
      </p>
    </aside>
  );
}
