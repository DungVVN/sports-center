import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { bookingApi } from "./booking-api.js";
import "../members/members.css";

const emptyForm = { memberId: "", classId: "" };
const labels = { confirmed: "Đã xác nhận", waitlisted: "Danh sách chờ", cancelled: "Đã hủy" };

export function BookingsPage({ session }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const isMember = session?.user.role === "member";

  async function load() {
    setLoading(true);
    try { setItems(await bookingApi.list(isMember ? undefined : form.memberId || undefined)); }
    catch (caught) { setError(caught.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    void Promise.resolve().then(async () => {
      setLoading(true);
      try { setItems(await bookingApi.list()); }
      catch (caught) { setError(caught.message); }
      finally { setLoading(false); }
    });
  }, []);

  async function create(event) {
    event.preventDefault();
    setError(""); setNotice("");
    try {
      const booking = await bookingApi.create({ classId: form.classId, ...(isMember ? {} : { memberId: form.memberId }) });
      setNotice(booking.status === "waitlisted" ? "Lớp đã đủ chỗ. Hội viên đã vào danh sách chờ." : "Đặt chỗ thành công.");
      setForm(emptyForm);
      await load();
    } catch (caught) { setError(caught.message); }
  }

  async function cancel(item) {
    const reason = window.prompt("Lý do hủy đặt chỗ (ít nhất 3 ký tự):");
    if (!reason) return;
    setError(""); setNotice("");
    try { await bookingApi.cancel(item.id, reason); setNotice("Đã hủy đặt chỗ. Danh sách chờ sẽ được cập nhật tự động nếu có."); await load(); }
    catch (caught) { setError(caught.message); }
  }

  return <main className="members-page"><header><p>Đặt chỗ</p><h1>Quản lý đặt lớp</h1></header>
    {error && <p className="auth-alert" role="alert">{error}</p>}{notice && <p className="auth-success" role="status">{notice}</p>}
    <section className="members-grid">
      <form className="members-form" onSubmit={create}><h2>Đặt lớp</h2>
        {!isMember && <label>Mã hội viên<input value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })} placeholder="UUID hội viên" required /></label>}
        <label>Mã lớp<input value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })} placeholder="UUID lớp đã công bố" required /></label>
        <p className="form-helper">Lớp đủ chỗ sẽ tự động chuyển vào danh sách chờ. Hội viên chỉ được hủy trước giờ học tối thiểu 5 giờ.</p>
        <Button type="submit">Đặt chỗ</Button>
      </form>
      <section className="members-list"><div className="list-heading"><h2>{isMember ? "Lịch đặt của tôi" : "Lịch sử đặt chỗ"}</h2><Button variant="ghost" size="sm" onClick={load}>Tải lại</Button></div>
        {loading ? <p>Đang tải…</p> : items.length === 0 ? <p>Chưa có lịch đặt chỗ.</p> : <div className="table-scroll"><table><thead><tr><th>Mã</th><th>Lớp học</th><th>Trạng thái</th><th>Thời điểm đặt</th><th>Thao tác</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><code>{item.booking_code}</code></td><td>{item.class_session?.name ?? item.class_session_id}</td><td>{labels[item.status] ?? item.status}</td><td>{new Date(item.booked_at).toLocaleString("vi-VN")}</td><td>{["confirmed", "waitlisted"].includes(item.status) && <Button variant="ghost" size="sm" onClick={() => cancel(item)}>Hủy</Button>}</td></tr>)}</tbody></table></div>}
      </section>
    </section>
  </main>;
}
