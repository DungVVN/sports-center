import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { dashboardApi } from "./dashboard-api.js";
import "../members/members.css";

export function AuditLogsPage() {
  const [items, setItems] = useState([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { setItems(await dashboardApi.auditLogs()); } catch (caught) { setError(caught.message); } finally { setLoading(false); } }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  return <main className="members-page"><header><p>Kiểm toán</p><h1>Nhật ký hoạt động</h1></header>{error && <p className="auth-alert" role="alert">{error}</p>}<section className="members-list"><div className="list-heading"><h2>Thao tác gần đây</h2><Button onClick={load} size="sm" variant="ghost">Tải lại</Button></div>{loading ? <p>Đang tải…</p> : items.length === 0 ? <p>Chưa có nhật ký phù hợp.</p> : <div className="table-scroll"><table><thead><tr><th>Thời điểm</th><th>Hành động</th><th>Đối tượng</th><th>Lý do</th><th>Yêu cầu</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString("vi-VN")}</td><td>{item.action}<small>{item.summary}</small></td><td><code>{item.entity_type}:{item.entity_id}</code></td><td>{item.reason ?? "—"}</td><td><code>{item.request_id ?? "—"}</code></td></tr>)}</tbody></table></div>}</section></main>;
}
