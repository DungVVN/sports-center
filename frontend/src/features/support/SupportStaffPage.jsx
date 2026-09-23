import { useCallback, useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "../../components/ui/Button.jsx";
import { supportApi } from "./support-api.js";
import "../members/members.css";

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

export function SupportStaffPage({ session }) {
  const canRespond = session?.permissions?.includes("support.ticket.respond") ?? false;
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("in_progress");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setTickets(await supportApi.list());
    } catch (caught) {
      setError(caught.message);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function open(id) {
    setError("");
    try {
      setSelected(await supportApi.detail(id));
    } catch (caught) {
      setError(caught.message);
    }
  }

  async function assign(id) {
    setError("");
    try {
      await supportApi.assignSelf(id);
      await load();
      await open(id);
    } catch (caught) {
      setError(caught.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await supportApi.respond(selected.ticket.id, { body: reply, status });
      setReply("");
      await load();
      await open(selected.ticket.id);
    } catch (caught) {
      setError(caught.message);
    }
  }

  return (
    <main className="members-page">
      <header>
        <p>Hỗ trợ</p>
        <h1>Yêu cầu cần xử lý</h1>
      </header>
      {error && <p className="auth-alert" role="alert">{error}</p>}
      <section className="members-grid">
        <section className="members-list">
          <div className="list-heading">
            <h2>Danh sách ticket</h2>
            <Button onClick={load} size="sm" type="button" variant="ghost">
              Tải lại
            </Button>
          </div>
          {tickets.length === 0 ? (
            <p>Không có ticket.</p>
          ) : (
            tickets.map((ticket) => (
              <article key={ticket.id}>
                <strong>
                  {ticket.ticket_code} · {ticket.subject}
                </strong>
                <p>
                  Trạng thái: <strong>{statusLabels[ticket.status] ?? ticket.status}</strong> · Mức độ:{" "}
                  <strong>{priorityLabels[ticket.priority] ?? ticket.priority}</strong> ·{" "}
                  {ticket.assigned_to ? "Đã có người phụ trách" : "Chưa phân công"}
                </p>
                <Button onClick={() => open(ticket.id)} size="sm" type="button" variant="secondary">
                  Xử lý
                </Button>
              </article>
            ))
          )}
        </section>
        {!selected ? (
          <section
            className="members-list support-empty-panel"
            style={{
              alignItems: "center",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minHeight: "360px",
              padding: "48px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                alignItems: "center",
                background: "var(--color-surface-muted)",
                borderRadius: "999px",
                color: "var(--color-primary)",
                display: "flex",
                height: "56px",
                justifyContent: "center",
                marginBottom: "16px",
                width: "56px",
              }}
            >
              <MessageSquare aria-hidden="true" size={26} />
            </div>
            <h3 style={{ color: "var(--color-text)", fontSize: "16px", margin: "0 0 6px" }}>
              Chưa chọn yêu cầu hỗ trợ
            </h3>
            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "13px",
                lineHeight: 1.5,
                margin: 0,
                maxWidth: "340px",
              }}
            >
              Chọn một ticket từ danh sách bên trái để xem nội dung chi tiết, nhận phụ trách và phản hồi hội viên.
            </p>
          </section>
        ) : (
          <section className="members-list">
            <div className="list-heading">
              <h2>{selected.ticket.ticket_code} · {selected.ticket.subject}</h2>
              <Button onClick={() => setSelected(null)} size="sm" type="button" variant="ghost">
                Đóng
              </Button>
            </div>
            <p style={{ margin: "0 0 12px" }}>
              Trạng thái: <strong>{statusLabels[selected.ticket.status] ?? selected.ticket.status}</strong> · Mức độ:{" "}
              <strong>{priorityLabels[selected.ticket.priority] ?? selected.ticket.priority}</strong>
            </p>
            <p>{selected.ticket.body}</p>
            {canRespond && <Button onClick={() => assign(selected.ticket.id)} size="sm" type="button" variant="secondary">
              Nhận phụ trách
            </Button>}
            <h3>Trao đổi</h3>
            {selected.responses.length === 0 ? (
              <p>Chưa có trao đổi nào.</p>
            ) : (
              selected.responses.map((item) => (
                <article key={item.id}>
                  <p>{item.body}</p>
                </article>
              ))
            )}
            {canRespond && <form className="members-form" onSubmit={submit}>
              <label>
                Phản hồi
                <textarea onChange={(event) => setReply(event.target.value)} required value={reply} />
              </label>
              <label>
                Trạng thái mới
                <select onChange={(event) => setStatus(event.target.value)} value={status}>
                  <option value="in_progress">Đang xử lý</option>
                  <option value="resolved">Đã xử lý</option>
                  <option value="closed">Đã đóng</option>
                </select>
              </label>
              <Button type="submit">Gửi phản hồi</Button>
            </form>}
          </section>
        )}
      </section>
    </main>
  );
}
