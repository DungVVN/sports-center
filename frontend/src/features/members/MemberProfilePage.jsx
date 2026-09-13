import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { memberApi } from "./member-api.js";
import "./members.css";
import "./MemberProfilePage.css";

function formatDate(value) { return value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật"; }

export function MemberProfilePage() {
  const [profile, setProfile] = useState(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setProfile(await memberApi.me()); } catch (caught) { setError(caught.message); } finally { setLoading(false); } }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  return <main className="members-page"><header><p>Hồ sơ</p><h1>Thông tin hội viên</h1></header>{error && <p className="auth-alert" role="alert">{error}</p>}{loading ? <p>Đang tải hồ sơ…</p> : profile && <section className="members-grid"><article className="members-list"><div className="list-heading"><h2>{profile.fullName}</h2><Button onClick={load} size="sm" variant="ghost">Tải lại</Button></div><dl className="profile-details"><div><dt>Mã hội viên</dt><dd>{profile.memberCode}</dd></div><div><dt>Email</dt><dd>{profile.email ?? "Chưa cập nhật"}</dd></div><div><dt>Số điện thoại</dt><dd>{profile.phone}</dd></div><div><dt>Ngày sinh</dt><dd>{formatDate(profile.dateOfBirth)}</dd></div><div><dt>Giới tính</dt><dd>{profile.gender ?? "Chưa cập nhật"}</dd></div><div><dt>Tham gia từ</dt><dd>{formatDate(profile.joinedAt)}</dd></div></dl></article><section className="members-list"><h2>Liên hệ khẩn cấp</h2>{profile.contacts.length === 0 ? <p>Chưa có liên hệ khẩn cấp.</p> : <div className="table-scroll"><table><thead><tr><th>Họ tên</th><th>Quan hệ</th><th>Số điện thoại</th></tr></thead><tbody>{profile.contacts.map((contact) => <tr key={contact.id}><td>{contact.fullName}{contact.isPrimary && <small>Liên hệ chính</small>}</td><td>{contact.relationship}</td><td>{contact.phone}</td></tr>)}</tbody></table></div>}</section></section>}</main>;
}
