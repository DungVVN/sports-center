import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { authApi } from "./auth-api.js";
import "../members/members.css";

export function RegistrationApprovalPage() {
  const [items, setItems] = useState([]); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [loading, setLoading] = useState(true); const [approvingId, setApprovingId] = useState("");
  const load = useCallback(async () => { setLoading(true); try { setItems(await authApi.pendingRegistrations()); } catch (caught) { setError(caught.message); } finally { setLoading(false); } }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  async function approve(userId) { setError(""); setNotice(""); setApprovingId(userId); try { await authApi.approveRegistration(userId); setNotice("Đã duyệt tài khoản hội viên. Hội viên có thể đăng nhập."); await load(); } catch (caught) { setError(caught.message); } finally { setApprovingId(""); } }
  return <main className="members-page"><header><p>Đăng ký hội viên</p><h1>Chờ Lễ tân duyệt</h1></header>{error && <p className="auth-alert" role="alert">{error}</p>}{notice && <p className="auth-success" role="status">{notice}</p>}<section className="members-list"><div className="list-heading"><h2>Tài khoản đã xác thực</h2><Button onClick={load} size="sm" variant="ghost">Tải lại</Button></div>{loading ? <p>Đang tải…</p> : items.length === 0 ? <p>Không có đăng ký chờ duyệt.</p> : <div className="table-scroll"><table><thead><tr><th>Hội viên</th><th>Email</th><th>Số điện thoại</th><th>Đăng ký lúc</th><th>Thao tác</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.fullName}</strong></td><td>{item.email}</td><td>{item.phone}</td><td>{item.createdAt ? new Date(item.createdAt).toLocaleString("vi-VN") : "—"}</td><td><Button loading={approvingId === item.id} onClick={() => approve(item.id)} size="sm">Duyệt tài khoản</Button></td></tr>)}</tbody></table></div>}</section></main>;
}
