import { useState } from "react";
import { Button } from "../../../shared/ui/Button.jsx";
import { Dialog } from "../../../shared/ui/Dialog.jsx";
import { hasSessionPermission } from "../../auth/index.js";
import { useSupportWorkspace } from "../api/useSupportWorkspace.js";

const formatDate = (value) => value ? new Date(value).toLocaleString("vi-VN") : "—";

const statusLabels = {
  open: "Đang mở",
  in_progress: "Đang xử lý",
  resolved: "Đã giải quyết",
  closed: "Đã đóng",
};
const priorityLabels = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Cao",
};

export function SupportPage({ session }) {
  const canCreate = hasSessionPermission(session, "support.ticket.create");
  const [form, setForm] = useState({ subject: "", body: "", priority: "normal" });
  const [selectedId, setSelectedId] = useState(null);
  const workspace = useSupportWorkspace({ selectedId });

  async function submit(event) {
    event.preventDefault();
    try {
      await workspace.createTicket.mutateAsync(form);
      setForm({ subject: "", body: "", priority: "normal" });
    } catch { /* feedback is rendered below */ }
  }
  const detail = workspace.detail;

  return (
    <main className="members-page">
      <header>
        <p>Hỗ trợ</p>
        <h1>Yêu cầu hỗ trợ</h1>
      </header>
      {workspace.error && <p className="auth-alert" role="alert">{workspace.error}</p>}
      {workspace.notice && <p className="auth-success" role="status">{workspace.notice}</p>}
      <section className="members-grid">
        {canCreate && <form className="members-form" onSubmit={submit}>
          <label>
            Tiêu đề
            <input
              maxLength="200"
              required
              value={form.subject}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
            />
          </label>
          <label>
            Nội dung
            <textarea
              maxLength="5000"
              required
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
            />
          </label>
          <label>
            Mức độ
            <select
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
            >
              <option value="low">Thấp</option>
              <option value="normal">Bình thường</option>
              <option value="high">Cao</option>
            </select>
          </label>
          <Button type="submit">Gửi yêu cầu</Button>
        </form>}
        <section className="members-list">
          <div className="list-heading">
            <h2>Lịch sử yêu cầu</h2>
            <Button onClick={workspace.reload} size="sm" type="button" variant="ghost">
              Tải lại
            </Button>
          </div>
          {workspace.tickets.length === 0 ? (
            <p>Chưa có yêu cầu hỗ trợ.</p>
          ) : (
            workspace.tickets.map((item) => (
              <article key={item.id}>
                <strong>
                  {item.ticket_code} · {item.subject}
                </strong>
                <p>
                  Trạng thái: <strong>{statusLabels[item.status] ?? item.status}</strong> · Mức độ:{" "}
                  <strong>{priorityLabels[item.priority] ?? item.priority}</strong>
                </p>
                <Button onClick={() => setSelectedId(item.id)} size="sm" type="button" variant="secondary">
                  Xem trao đổi
                </Button>
              </article>
            ))
          )}
        </section>
      </section>
      <Dialog
        isOpen={Boolean(detail)}
        onClose={() => setSelectedId(null)}
        title={detail ? `${detail.ticket.ticket_code} · ${detail.ticket.subject}` : ""}
      >
        {detail && (
          <div style={{ display: "grid", gap: "16px", padding: "8px 0" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "13px" }}>
              <span>
                Trạng thái: <strong>{statusLabels[detail.ticket.status] ?? detail.ticket.status}</strong>
              </span>
              <span>·</span>
              <span>
                Mức độ: <strong>{priorityLabels[detail.ticket.priority] ?? detail.ticket.priority}</strong>
              </span>
            </div>
            <article style={{ background: "var(--color-surface-muted)", padding: "12px", borderRadius: "var(--radius-control)" }}>
              <strong style={{ display: "block", marginBottom: "6px" }}>Nội dung yêu cầu</strong>
              <p style={{ margin: "0 0 6px", whiteSpace: "pre-wrap" }}>{detail.ticket.body}</p>
              <small style={{ color: "var(--color-text-secondary)" }}>{formatDate(detail.ticket.created_at)}</small>
            </article>
            <div>
              <h3 style={{ margin: "0 0 10px", fontSize: "15px" }}>Phản hồi từ trung tâm</h3>
              {detail.responses.length === 0 ? (
                <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>Trung tâm chưa phản hồi. Yêu cầu vẫn được theo dõi.</p>
              ) : (
                <div style={{ display: "grid", gap: "10px", maxHeight: "200px", overflowY: "auto" }}>
                  {detail.responses.map((response) => (
                    <article key={response.id} style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "10px" }}>
                      <p style={{ margin: "0 0 4px", whiteSpace: "pre-wrap" }}>{response.body}</p>
                      <small style={{ color: "var(--color-text-secondary)" }}>{formatDate(response.created_at)}</small>
                    </article>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
              <Button onClick={() => setSelectedId(null)} size="sm" type="button" variant="secondary">
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </main>
  );
}
