import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "../../components/ui/Button.jsx";
import { hasSessionPermission } from "../../utils/session-permissions.js";
import { useSupportWorkspace } from "./hooks/useSupportWorkspace.js";

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
  const canRespond = hasSessionPermission(session, "support.ticket.respond");
  const [selectedId, setSelectedId] = useState(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("in_progress");
  const workspace = useSupportWorkspace({ selectedId });
  const selected = workspace.detail;

  async function assign(id) {
    try {
      await workspace.assignSelf.mutateAsync(id);
    } catch { /* feedback is rendered below */ }
  }

  async function submit(event) {
    event.preventDefault();
    try {
      await workspace.respond.mutateAsync({ id: selected.ticket.id, input: { body: reply, status } });
      setReply("");
    } catch { /* feedback is rendered below */ }
  }

  return (
    <main className="members-page">
      <header>
        <p>Hỗ trợ</p>
        <h1>Yêu cầu cần xử lý</h1>
      </header>
      {workspace.error && <p className="auth-alert" role="alert">{workspace.error}</p>}
      {workspace.notice && <p className="auth-success" role="status">{workspace.notice}</p>}
      <section className="members-workspace-stacked support-staff-workspace">
        <section className="members-list">
          <div className="list-heading">
            <h2>Danh sách ticket</h2>
            <Button onClick={workspace.reload} size="sm" type="button" variant="ghost">
              Tải lại
            </Button>
          </div>
          {workspace.tickets.length === 0 ? (
            <p>Không có ticket.</p>
          ) : (
            workspace.tickets.map((ticket) => (
              <article key={ticket.id}>
                <strong>
                  {ticket.ticket_code} · {ticket.subject}
                </strong>
                <p>
                  Trạng thái: <strong>{statusLabels[ticket.status] ?? ticket.status}</strong> · Mức độ:{" "}
                  <strong>{priorityLabels[ticket.priority] ?? ticket.priority}</strong> ·{" "}
                  {ticket.assigned_to ? "Đã có người phụ trách" : "Chưa phân công"}
                </p>
                <Button onClick={() => setSelectedId(ticket.id)} size="sm" type="button" variant="secondary">
                  Xử lý
                </Button>
              </article>
            ))
          )}
        </section>
        {!selected ? (
          <section className="members-list support-empty-panel">
            <div className="support-empty-panel__icon">
              <MessageSquare aria-hidden="true" size={26} />
            </div>
            <h3>Chưa chọn yêu cầu hỗ trợ</h3>
            <p>Chọn một ticket từ danh sách phía trên để xem nội dung chi tiết, nhận phụ trách và phản hồi hội viên.</p>
          </section>
        ) : (
          <section className="members-list">
            <div className="list-heading">
              <h2>{selected.ticket.ticket_code} · {selected.ticket.subject}</h2>
              <Button onClick={() => setSelectedId(null)} size="sm" type="button" variant="ghost">
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
