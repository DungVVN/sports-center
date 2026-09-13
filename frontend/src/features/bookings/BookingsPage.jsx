import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { classApi } from "../classes/class-api.js";
import { memberApi } from "../members/member-api.js";
import { bookingApi } from "./booking-api.js";
import "../members/members.css";

const emptyForm = { memberId: "", classId: "" };
const labels = { confirmed: "Đã xác nhận", waitlisted: "Danh sách chờ", cancelled: "Đã hủy" };

export function BookingsPage({ session }) {
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [cancellation, setCancellation] = useState({ booking: null, reason: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const isMember = session?.user.role === "member";
  const visibleClasses = useMemo(() => classes.filter((item) => item.status === "published" && new Date(item.starts_at) > new Date()), [classes]);

  const loadBookings = useCallback(async (memberId) => {
    setLoading(true);
    try { setItems(await bookingApi.list(isMember ? undefined : memberId || undefined)); }
    catch (caught) { setError(caught.message); }
    finally { setLoading(false); }
  }, [isMember]);

  const loadReferences = useCallback(async () => {
    try {
      const [nextClasses, nextMembers] = await Promise.all([classApi.list(), isMember ? Promise.resolve([]) : memberApi.list()]);
      setClasses(nextClasses); setMembers(nextMembers);
    } catch (caught) { setError(caught.message); }
  }, [isMember]);

  useEffect(() => { void Promise.resolve().then(async () => { await Promise.all([loadBookings(), loadReferences()]); }); }, [loadBookings, loadReferences]);

  function updateForm(event) { setForm((value) => ({ ...value, [event.target.name]: event.target.value })); }

  async function create(event) {
    event.preventDefault(); setError(""); setNotice(""); setSubmitting(true);
    try {
      const booking = await bookingApi.create({ classId: form.classId, ...(isMember ? {} : { memberId: form.memberId }) });
      setNotice(booking.status === "waitlisted" ? "Lớp đã đủ chỗ. Hội viên đã vào danh sách chờ." : "Đặt chỗ thành công.");
      setForm(emptyForm); await loadBookings(isMember ? undefined : form.memberId);
    } catch (caught) { setError(caught.message); }
    finally { setSubmitting(false); }
  }

  function openCancellation(booking) { setCancellation({ booking, reason: "" }); }
  function closeCancellation() { if (!submitting) setCancellation({ booking: null, reason: "" }); }

  async function cancel(event) {
    event.preventDefault();
    if (!cancellation.booking || cancellation.reason.trim().length < 3) { setError("Lý do hủy cần có ít nhất 3 ký tự."); return; }
    setError(""); setNotice(""); setSubmitting(true);
    try {
      await bookingApi.cancel(cancellation.booking.id, cancellation.reason.trim());
      setNotice("Đã hủy đặt chỗ. Danh sách chờ sẽ được cập nhật tự động nếu có.");
      setCancellation({ booking: null, reason: "" }); await loadBookings(isMember ? undefined : form.memberId);
    } catch (caught) { setError(caught.message); }
    finally { setSubmitting(false); }
  }

  return <main className="members-page"><header><p>Đặt chỗ</p><h1>Quản lý đặt lớp</h1></header>
    {error && <p className="auth-alert" role="alert">{error}</p>}{notice && <p className="auth-success" role="status">{notice}</p>}
    <section className="members-grid"><form className="members-form" onSubmit={create}><h2>Đặt lớp</h2>
      {!isMember && <label>Hội viên<select name="memberId" onChange={updateForm} required value={form.memberId}><option value="">Chọn hội viên</option>{members.map((member) => <option key={member.id} value={member.id}>{member.fullName} — {member.memberCode}</option>)}</select></label>}
      <label>Lớp học<select name="classId" onChange={updateForm} required value={form.classId}><option value="">Chọn lớp đã công bố</option>{visibleClasses.map((item) => <option key={item.id} value={item.id}>{item.name} · {new Date(item.starts_at).toLocaleString("vi-VN")}</option>)}</select></label>
      <p className="form-helper">Lớp đủ chỗ sẽ tự động chuyển vào danh sách chờ. Hội viên chỉ được hủy trước giờ học tối thiểu 5 giờ.</p>
      <Button loading={submitting} type="submit">Đặt chỗ</Button>
    </form>
      <section className="members-list"><div className="list-heading"><h2>{isMember ? "Lịch đặt của tôi" : "Lịch sử đặt chỗ"}</h2><Button onClick={() => loadBookings(form.memberId)} size="sm" variant="ghost">Tải lại</Button></div>
        {loading ? <p>Đang tải…</p> : items.length === 0 ? <p>Chưa có lịch đặt chỗ.</p> : <div className="table-scroll"><table><thead><tr><th>Mã</th><th>Lớp học</th><th>Trạng thái</th><th>Thời điểm đặt</th><th>Thao tác</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><code>{item.booking_code}</code></td><td>{item.class_session?.name ?? "Lớp học"}</td><td>{labels[item.status] ?? item.status}</td><td>{new Date(item.booked_at).toLocaleString("vi-VN")}</td><td>{["confirmed", "waitlisted"].includes(item.status) && <Button onClick={() => openCancellation(item)} size="sm" variant="ghost">Hủy</Button>}</td></tr>)}</tbody></table></div>}
      </section>
    </section>
    <Dialog isOpen={Boolean(cancellation.booking)} onClose={closeCancellation} title="Hủy đặt chỗ"><form onSubmit={cancel}><div className="dialog__body"><p className="dialog__helper">Bạn chỉ có thể hủy trước giờ học ít nhất 5 giờ. Nếu booking được xác nhận, người đầu tiên trong danh sách chờ sẽ được chuyển lên tự động.</p><label>Lý do hủy<textarea minLength="3" onChange={(event) => setCancellation((value) => ({ ...value, reason: event.target.value }))} required value={cancellation.reason} /></label></div><div className="dialog__actions"><Button disabled={submitting} onClick={closeCancellation} type="button" variant="secondary">Quay lại</Button><Button loading={submitting} type="submit" variant="danger">Xác nhận hủy</Button></div></form></Dialog>
  </main>;
}
