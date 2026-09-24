import { Button } from "../../../components/ui/Button.jsx";

export function MemberCreateForm({ form, onChange, onSubmit, submitting }) {
  return <form className="members-form members-form--member-create" onSubmit={onSubmit}>
    <h2>Thêm hội viên</h2>
    <label>Họ tên<input disabled={submitting} name="fullName" onChange={onChange} required value={form.fullName} /></label>
    <label>Email<input disabled={submitting} name="email" onChange={onChange} type="email" value={form.email} /></label>
    <label>Số điện thoại<input disabled={submitting} name="phone" onChange={onChange} required value={form.phone} /></label>
    <Button loading={submitting} type="submit">Tạo hội viên</Button>
  </form>;
}
