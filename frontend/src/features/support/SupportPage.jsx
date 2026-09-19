import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { supportApi } from "./support-api.js";
import "../members/members.css";

const formatDate = (value) => value ? new Date(value).toLocaleString("vi-VN") : "—";

export function SupportPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ subject: "", body: "", priority: "normal" });
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const load = async () => { try { setItems(await supportApi.list()); } catch (caught) { setError(caught.message); } };
  useEffect(() => { void Promise.resolve().then(load); }, []);
  async function submit(event) { event.preventDefault(); setError(""); try { await supportApi.create(form); setForm({ subject: "", body: "", priority: "normal" }); await load(); } catch (caught) { setError(caught.message); } }
  async function showDetail(id) { setError(""); try { setDetail(await supportApi.detail(id)); } catch (caught) { setError(caught.message); } }

  return <main className="members-page"><header><p>Hỗ trợ</p><h1>Yêu cầu hỗ trợ</h1></header>{error && <p className="auth-alert" role="alert">{error}</p>}
    <section className="members-grid"><form className="members-form" onSubmit={submit}><label>Tiêu đề<input maxLength="200" required value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label><label>Nội dung<textarea maxLength="5000" required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label><label>Mức độ<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="low">Thấp</option><option value="normal">Bình thường</option><option value="high">Cao</option></select></label><Button type="submit">Gửi yêu cầu</Button></form>
      <section className="members-list"><div className="list-heading"><h2>Lịch sử yêu cầu</h2><Button onClick={load} size="sm" type="button" variant="ghost">Tải lại</Button></div>{items.length === 0 ? <p>Chưa có yêu cầu hỗ trợ.</p> : items.map((item) => <article key={item.id}><strong>{item.ticket_code} · {item.subject}</strong><p>Trạng thái: {item.status} · Ưu tiên: {item.priority}</p><Button onClick={() => showDetail(item.id)} size="sm" type="button" variant="secondary">Xem trao đổi</Button></article>)}</section>
    </section>
    {detail && <section className="members-list"><div className="list-heading"><div><h2>{detail.ticket.ticket_code} · {detail.ticket.subject}</h2><p>Trạng thái: {detail.ticket.status}</p></div><Button onClick={() => setDetail(null)} size="sm" type="button" variant="ghost">Đóng</Button></div><article><strong>Nội dung yêu cầu</strong><p>{detail.ticket.body}</p><small>{formatDate(detail.ticket.created_at)}</small></article><h3>Phản hồi từ trung tâm</h3>{detail.responses.length === 0 ? <p>Trung tâm chưa phản hồi. Yêu cầu vẫn được theo dõi.</p> : detail.responses.map((response) => <article key={response.id}><p>{response.body}</p><small>{formatDate(response.created_at)}</small></article>)}</section>}
  </main>;
}
