import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "../../../shared/ui/Button.jsx";
export function ProfilePasswordForm({
  changePassword,
  passwordForm,
  setPasswordForm,
  workspace,
}) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  return (
    <form
      className="members-form profile-page__form profile-page__password-form"
      onSubmit={changePassword}
    >
      <div className="list-heading">
        <div>
          <h2>Đổi mật khẩu</h2>
          <p id="profile-new-password-hint">
            Mật khẩu mới cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.
          </p>
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
              aria-label={
                showCurrentPassword
                  ? "Ẩn mật khẩu hiện tại"
                  : "Hiện mật khẩu hiện tại"
              }
            >
              {showCurrentPassword ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
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
              aria-label={
                showNewPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"
              }
            >
              {showNewPassword ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
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
              aria-label={
                showConfirmPassword
                  ? "Ẩn xác nhận mật khẩu"
                  : "Hiện xác nhận mật khẩu"
              }
            >
              {showConfirmPassword ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
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
  );
}
