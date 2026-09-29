import { Button } from "../../../shared/ui/Button.jsx";

export function MemberCreateForm({ form, onChange, onSubmit, submitting }) {
  return <form className="members-form members-form--member-create" onSubmit={onSubmit}>
    <h2>Thêm hội viên</h2>
    <label>Họ tên<input disabled={submitting} name="fullName" onChange={onChange} required value={form.fullName} /></label>
    <label>Email<input disabled={submitting} name="email" onChange={onChange} required={form.createAccount} type="email" value={form.email} /></label>
    <label>Số điện thoại<input disabled={submitting} name="phone" onChange={onChange} required value={form.phone} /></label>
    <label className="member-create-account"><input checked={form.createAccount} disabled={submitting} name="createAccount" onChange={onChange} type="checkbox" />Tạo tài khoản đăng nhập và gửi mật khẩu tạm qua email</label>
    <Button loading={submitting} type="submit">Tạo hội viên</Button>
  </form>;
}
