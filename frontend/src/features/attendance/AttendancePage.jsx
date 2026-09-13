import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { bookingApi } from "../bookings/booking-api.js";
import { classApi } from "../classes/class-api.js";
import { attendanceApi } from "./attendance-api.js";
import "../members/members.css";

const statusLabels = { present: "Có mặt", absent: "Vắng", late: "Đi trễ", not_marked: "Chưa ghi nhận" };
const emptyCorrection = { record: null, status: "present", reason: "" };

export function AttendancePage({ session }) {
  const [bookingId, setBookingId] = useState("");
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [records, setRecords] = useState([]);
  const [correction, setCorrection] = useState(emptyCorrection);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const coachId = session?.user.role === "coach" ? session.user.id : null;
  const availableClasses = useMemo(() => classes.filter((item) => !coachId || item.coach_user_id === coachId), [classes, coachId]);
  const classBookings = useMemo(() => bookings.filter((item) => item.class_session_id === classId && ["confirmed", "attended"].includes(item.status)), [bookings, classId]);

  const loadReferences = useCallback(async () => {
    setLoading(true);
    try { const [nextClasses, nextBookings] = await Promise.all([classApi.list(), bookingApi.list()]); setClasses(nextClasses); setBookings(nextBookings); }
    catch (caught) { setError(caught.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void Promise.resolve().then(loadReferences); }, [loadReferences]);

  async function refresh(nextClassId = classId) {
    if (!nextClassId) return;
    setRecords(await attendanceApi.byClass(nextClassId));
  }

  async function selectClass(event) {
    const selected = event.target.value; setClassId(selected); setRecords([]); setError("");
    if (!selected) return;
    try { await refresh(selected); } catch (caught) { setError(caught.message); }
  }

  async function checkIn(event) {
    event.preventDefault(); setError(""); setNotice(""); setSubmitting(true);
    try { await attendanceApi.checkIn(bookingId); setBookingId(""); setNotice("Đã check-in cho buổi học."); await refresh(); }
    catch (caught) { setError(caught.message); }
    finally { setSubmitting(false); }
  }

  async function checkOut(id) {
    setError(""); setNotice(""); setSubmitting(true);
    try { await attendanceApi.checkOut(id); await refresh(); setNotice("Đã check-out buổi học."); }
    catch (caught) { setError(caught.message); }
    finally { setSubmitting(false); }
  }

  function openCorrection(record) { setCorrection({ record, status: record.status, reason: "" }); }
  function closeCorrection() { if (!submitting) setCorrection(emptyCorrection); }

  async function correct(event) {
    event.preventDefault();
    if (!correction.record || correction.reason.trim().length < 3) { setError("Lý do sửa điểm danh cần có ít nhất 3 ký tự."); return; }
    setError(""); setNotice(""); setSubmitting(true);
    try { await attendanceApi.correct(correction.record.id, { status: correction.status, reason: correction.reason.trim() }); await refresh(); setCorrection(emptyCorrection); setNotice("Đã sửa điểm danh và lưu audit."); }
    catch (caught) { setError(caught.message); }
    finally { setSubmitting(false); }
  }

  return <main className="members-page"><header><p>Điểm danh</p><h1>Điểm danh theo buổi học</h1></header>{error && <p className="auth-alert" role="alert">{error}</p>}{notice && <p className="auth-success" role="status">{notice}</p>}
    <div className="members-grid"><form className="members-form" onSubmit={checkIn}><h2>Check-in theo booking</h2><label>Buổi học<select onChange={selectClass} required value={classId}><option value="">Chọn lớp học</option>{availableClasses.map((item) => <option key={item.id} value={item.id}>{item.name} · {new Date(item.starts_at).toLocaleString("vi-VN")}</option>)}</select></label><label>Hội viên đã đặt chỗ<select onChange={(event) => setBookingId(event.target.value)} required value={bookingId}><option value="">Chọn booking</option>{classBookings.map((item) => <option key={item.id} value={item.id}>{item.member_id} · {item.booking_code}</option>)}</select></label><Button disabled={!classId || loading} loading={submitting} type="submit">Xác nhận check-in</Button><small>Mỗi booking của một buổi học chỉ tạo một lượt điểm danh.</small></form>
      <section className="members-list"><div className="list-heading"><h2>Danh sách điểm danh lớp</h2><Button disabled={!classId} onClick={() => refresh()} size="sm" variant="ghost">Tải lại</Button></div>{loading ? <p>Đang tải dữ liệu…</p> : !classId ? <p>Chọn buổi học để xem điểm danh.</p> : records.length === 0 ? <p>Chưa có lượt điểm danh.</p> : <div className="table-scroll"><table><thead><tr><th>Hội viên</th><th>Trạng thái</th><th>Check-in</th><th>Check-out</th><th>Thao tác</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td><code>{record.member_id}</code></td><td>{statusLabels[record.status] ?? record.status}</td><td>{record.checked_in_at ? new Date(record.checked_in_at).toLocaleString("vi-VN") : "—"}</td><td>{record.checked_out_at ? new Date(record.checked_out_at).toLocaleString("vi-VN") : "—"}</td><td>{record.status === "present" && !record.checked_out_at && <Button disabled={submitting} onClick={() => checkOut(record.id)} size="sm" type="button" variant="secondary">Check-out</Button>} <Button disabled={submitting} onClick={() => openCorrection(record)} size="sm" type="button" variant="ghost">Sửa</Button></td></tr>)}</tbody></table></div>}</section>
    </div>
    <Dialog isOpen={Boolean(correction.record)} onClose={closeCorrection} title="Sửa điểm danh"><form onSubmit={correct}><div className="dialog__body"><p className="dialog__helper">Mọi thay đổi điểm danh sẽ được lưu vào audit kèm lý do và người thực hiện.</p><label>Trạng thái mới<select disabled={submitting} onChange={(event) => setCorrection((value) => ({ ...value, status: event.target.value }))} value={correction.status}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Lý do sửa<textarea disabled={submitting} minLength="3" onChange={(event) => setCorrection((value) => ({ ...value, reason: event.target.value }))} required value={correction.reason} /></label></div><div className="dialog__actions"><Button disabled={submitting} onClick={closeCorrection} type="button" variant="secondary">Quay lại</Button><Button loading={submitting} type="submit">Lưu thay đổi</Button></div></form></Dialog>
  </main>;
}
