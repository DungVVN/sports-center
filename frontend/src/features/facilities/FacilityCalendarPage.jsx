import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationFeedback } from "../../hooks/useMutationFeedback.js";
import { facilityApi } from "./facility-api.js";
import "./facilities.css";

const localDate = (offset = 0) => {
  const date = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
};
const clock = (minute) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const minute = (value) => { const [hour, part] = value.split(":").map(Number); return hour * 60 + part; };
const labels = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối", cancelled: "Đã hủy" };

export function FacilityCalendarPage({ session, onLoginClick }) {
  const client = useQueryClient();
  const [from, setFrom] = useState(localDate());
  const [to, setTo] = useState(localDate(7));
  const [typeId, setTypeId] = useState("");
  const [form, setForm] = useState({ dayId: "", start: "", end: "", participantCount: 1, phone: "" });
  const [typeName, setTypeName] = useState("");
  const [facility, setFacility] = useState({ typeId: "", name: "", open: "06:00", close: "22:00" });
  const [newDay, setNewDay] = useState({ facilityId: "", date: localDate() });
  const [decision, setDecision] = useState({ id: "", start: "", end: "", reason: "" });
  const [cancellation, setCancellation] = useState({ id: "", reason: "" });
  const feedback = useMutationFeedback();
  const [busy, setBusy] = useState(false);
  const granted = new Set(session?.permissions ?? []);
  const can = (code) => session?.user.role === "admin" || granted.has(code);
  const dateRangeValid = from <= to && (Date.parse(to) - Date.parse(from)) / 86400000 <= 30;
  const calendar = useQuery({ queryKey: ["facility-calendar", from, to, typeId], queryFn: () => facilityApi.calendar({ from, to, typeId }), enabled: dateRangeValid, retry: false });
  const mine = useQuery({ queryKey: ["facility-reservations-me"], queryFn: facilityApi.mine, enabled: Boolean(session && can("facility.booking.self.read")), retry: false });
  const staff = useQuery({ queryKey: ["facility-reservations-staff"], queryFn: facilityApi.reservations, enabled: Boolean(session && can("facility.booking.read")), retry: false });

  async function perform(action, success) {
    setBusy(true); feedback.clear();
    try { const result = await action(); feedback.setNotice(typeof success === "function" ? success(result) : success); await client.invalidateQueries({ queryKey: ["facility-calendar"] }); await client.invalidateQueries({ queryKey: ["facility-reservations-me"] }); await client.invalidateQueries({ queryKey: ["facility-reservations-staff"] }); return true; }
    catch (cause) { feedback.setError(cause.message); return false; }
    finally { setBusy(false); }
  }

  async function reviewReservation(approved) {
    const payload = approved
      ? { approved: true, startMinute: minute(decision.start), endMinute: minute(decision.end) }
      : { approved: false, reason: decision.reason.trim() };
    const completed = await perform(() => facilityApi.review(decision.id, payload), approved ? "Đã duyệt đơn." : "Đã từ chối đơn.");
    if (completed) setDecision({ id: "", start: "", end: "", reason: "" });
  }

  async function cancelReservation() {
    const completed = await perform(() => facilityApi.cancel(cancellation.id, cancellation.reason.trim()), (result) => result.cancellationPending ? "Đã gửi yêu cầu hủy, chờ người tạo đơn xác nhận." : "Đã hủy đơn.");
    if (completed) setCancellation({ id: "", reason: "" });
  }

  async function confirmCancellation(id) {
    await perform(() => facilityApi.confirmCancellation(id), "Đã xác nhận hủy đơn.");
  }

  return <section id="facility-calendar" className="members-page facility-calendar">
    <header className="facility-calendar__header"><p className="facility-calendar__eyebrow">LỊCH SÂN</p><h1>Giờ trống & lịch đã đặt</h1></header>
    <section className="facility-calendar__filter-panel" aria-label="Bộ lọc lịch sân">
      <div className="facility-calendar__filters">
        <label>Loại sân<select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">Tất cả</option>{(calendar.data?.types ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Từ ngày<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Đến ngày<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
    </section>
    {!dateRangeValid && <p role="alert">Chọn khoảng ngày hợp lệ, tối đa 31 ngày.</p>}
    <div className="facility-calendar__table-wrap">
      <table className="facility-calendar__table">
        <caption>Lịch sân từ {from} đến {to}</caption>
        <thead><tr><th scope="col">Ngày</th><th scope="col">Sân</th><th scope="col">Giờ hoạt động</th><th scope="col">Giờ trống</th><th scope="col">Đã đặt</th>{can("facility.booking.request") && <th scope="col">Đặt sân</th>}</tr></thead>
        <tbody>
          {!dateRangeValid && <tr><td colSpan={can("facility.booking.request") ? 6 : 5}>Chọn khoảng ngày hợp lệ để xem lịch sân.</td></tr>}
          {dateRangeValid && calendar.isPending && <tr><td colSpan={can("facility.booking.request") ? 6 : 5} role="status">Đang tải lịch sân...</td></tr>}
          {dateRangeValid && calendar.isError && <tr><td colSpan={can("facility.booking.request") ? 6 : 5} role="alert">Không tải được lịch sân. <button type="button" onClick={() => calendar.refetch()}>Tải lại lịch sân</button></td></tr>}
          {calendar.data?.days.length === 0 && <tr><td colSpan={can("facility.booking.request") ? 6 : 5}>Chưa có ngày mở đặt sân trong khoảng đã chọn.</td></tr>}
          {calendar.data?.days.map((day) => {
            const court = calendar.data.facilities.find((item) => item.id === day.facilityId);
            const kind = calendar.data.types.find((item) => item.id === court?.typeId);
            return <tr key={day.id}>
              <th scope="row">{day.date}</th>
              <td><strong>{court?.name}</strong><span className="facility-calendar__court-type">{kind?.name}</span></td>
              <td>{court ? `${clock(court.openMinute)}–${clock(court.closeMinute)}` : "—"}</td>
              <td><div className="facility-calendar__periods">{day.free.length ? day.free.map((period) => <span className="facility-calendar__free" key={`${period.startMinute}-${period.endMinute}`}>{clock(period.startMinute)}–{clock(period.endMinute)}</span>) : <span>Hết giờ trống</span>}</div></td>
              <td><div className="facility-calendar__periods">{day.booked.length ? day.booked.map((period) => <span className="facility-calendar__booked" key={`${period.startMinute}-${period.endMinute}`}>{clock(period.startMinute)}–{clock(period.endMinute)}</span>) : <span>Chưa có</span>}</div></td>
              {can("facility.booking.request") && <td><button type="button" onClick={() => setForm((current) => ({ ...current, dayId: day.id }))}>Yêu cầu đặt ngày này</button></td>}
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    {!session && <p className="facility-calendar__prompt">Bạn cần đăng nhập để gửi yêu cầu đặt sân. <button type="button" onClick={onLoginClick}>Đặt sân ngay</button></p>}
    {can("facility.booking.request") && <form className="facility-calendar__panel" onSubmit={(event) => { event.preventDefault(); void perform(() => facilityApi.request({ dayId: form.dayId, startMinute: minute(form.start), endMinute: minute(form.end), participantCount: Number(form.participantCount), phone: form.phone }), "Đã gửi yêu cầu, vui lòng chờ Lễ tân duyệt."); }}><h3>Gửi yêu cầu đặt sân</h3><p>Người đặt: {session.user.displayName}. Lễ tân có thể điều chỉnh giờ khi duyệt.</p><div className="facility-calendar__fields"><label>Ngày và sân<select required value={form.dayId} onChange={(event) => setForm({ ...form, dayId: event.target.value })}><option value="">Chọn ngày và sân</option>{calendar.data?.days.map((day) => <option key={day.id} value={day.id}>{calendar.data.facilities.find((item) => item.id === day.facilityId)?.name} · {day.date}</option>)}</select></label><label>Giờ bắt đầu<input required type="time" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></label><label>Giờ kết thúc<input required type="time" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} /></label><label>Số người tham gia<input required type="number" min="1" max="100" value={form.participantCount} onChange={(event) => setForm({ ...form, participantCount: event.target.value })} /></label><label>Số điện thoại<input required type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label></div><button disabled={busy} type="submit">Gửi yêu cầu</button></form>}
    {can("facility.booking.self.read") && <section className="facility-calendar__panel"><h3>Đơn đặt của tôi</h3>{mine.isPending ? <p>Đang tải...</p> : mine.isError ? <p role="alert">Không tải được đơn. <button onClick={() => mine.refetch()}>Thử lại</button></p> : mine.data?.length ? <ul>{mine.data.map((item) => <li key={item.id}>{item.facilityName} · {item.date} · {clock(item.assignedStartMinute ?? item.requestedStartMinute)}–{clock(item.assignedEndMinute ?? item.requestedEndMinute)} · {labels[item.status]}{item.cancellationPending && <><span> · Có yêu cầu hủy: {item.cancellationReason}</span><button type="button" disabled={busy} onClick={() => void confirmCancellation(item.id)}>Xác nhận hủy</button></>}{["pending", "approved"].includes(item.status) && !item.cancellationPending && can("facility.booking.cancel") && <button type="button" disabled={busy} onClick={() => setCancellation({ id: item.id, reason: "" })}>Hủy đơn</button>}</li>)}</ul> : <p>Chưa có đơn đặt sân.</p>}</section>}
    {(can("facility.manage") || can("facility.day.manage")) && <section className="facility-calendar__panel"><h3>Quản lý sân và ngày mở</h3>{can("facility.manage") && <><form onSubmit={(event) => { event.preventDefault(); void perform(() => facilityApi.createType({ name: typeName }), "Đã thêm loại sân."); }}><label>Tên loại sân<input required value={typeName} onChange={(event) => setTypeName(event.target.value)} /></label><button disabled={busy}>Thêm loại sân</button></form><form onSubmit={(event) => { event.preventDefault(); void perform(() => facilityApi.createFacility({ typeId: facility.typeId, name: facility.name, openMinute: minute(facility.open), closeMinute: minute(facility.close) }), "Đã thêm sân."); }}><div className="facility-calendar__fields"><label>Loại sân<select required value={facility.typeId} onChange={(event) => setFacility({ ...facility, typeId: event.target.value })}><option value="">Chọn loại</option>{calendar.data?.types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Tên sân<input required value={facility.name} onChange={(event) => setFacility({ ...facility, name: event.target.value })} /></label><label>Giờ mở<input required type="time" value={facility.open} onChange={(event) => setFacility({ ...facility, open: event.target.value })} /></label><label>Giờ đóng<input required type="time" value={facility.close} onChange={(event) => setFacility({ ...facility, close: event.target.value })} /></label></div><button disabled={busy}>Thêm sân</button></form></>}{can("facility.day.manage") && <form onSubmit={(event) => { event.preventDefault(); void perform(() => facilityApi.createDay(newDay), "Đã mở ngày đặt sân."); }}><div className="facility-calendar__fields"><label>Sân<select required value={newDay.facilityId} onChange={(event) => setNewDay({ ...newDay, facilityId: event.target.value })}><option value="">Chọn sân</option>{calendar.data?.facilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Ngày mở<input required type="date" value={newDay.date} onChange={(event) => setNewDay({ ...newDay, date: event.target.value })} /></label></div><button disabled={busy}>Mở ngày</button></form>}</section>}
    {can("facility.booking.read") && <section className="facility-calendar__panel"><h3>Yêu cầu đặt sân</h3>{staff.isPending ? <p>Đang tải...</p> : staff.isError ? <p role="alert">Không tải được đơn. <button onClick={() => staff.refetch()}>Thử lại</button></p> : staff.data?.length ? <ul>{staff.data.map((item) => <li key={item.id}><strong>{item.requesterName}</strong> · {item.phone} · {item.participantCount} người · {item.facilityName} · {item.date} · {clock(item.requestedStartMinute)}–{clock(item.requestedEndMinute)} · {labels[item.status]}{item.status === "pending" && can("facility.booking.approve") && <button type="button" onClick={() => setDecision({ id: item.id, start: clock(item.requestedStartMinute), end: clock(item.requestedEndMinute), reason: "" })}>Xử lý</button>}{["pending", "approved"].includes(item.status) && can("facility.booking.cancel") && <button type="button" disabled={busy} onClick={() => setCancellation({ id: item.id, reason: "" })}>Hủy đơn</button>}</li>)}</ul> : <p>Chưa có yêu cầu đặt sân.</p>}</section>}
    {cancellation.id && <form className="facility-calendar__panel" onSubmit={(event) => { event.preventDefault(); void cancelReservation(); }}><h3>Hủy đơn đặt sân</h3><label>Lý do hủy<input required minLength="3" maxLength="500" value={cancellation.reason} onChange={(event) => setCancellation({ ...cancellation, reason: event.target.value })} /></label><button disabled={busy || cancellation.reason.trim().length < 3}>Xác nhận hủy</button><button type="button" onClick={() => setCancellation({ id: "", reason: "" })}>Đóng</button></form>}
    {decision.id && <form className="facility-calendar__panel" onSubmit={(event) => { event.preventDefault(); void reviewReservation(true); }}><h3>Chốt giờ đặt sân</h3><div className="facility-calendar__fields"><label>Từ giờ<input required type="time" value={decision.start} onChange={(event) => setDecision({ ...decision, start: event.target.value })} /></label><label>Đến giờ<input required type="time" value={decision.end} onChange={(event) => setDecision({ ...decision, end: event.target.value })} /></label><label>Lý do từ chối<input value={decision.reason} onChange={(event) => setDecision({ ...decision, reason: event.target.value })} /></label></div><button disabled={busy}>Duyệt đơn</button><button type="button" disabled={busy || decision.reason.trim().length < 3} onClick={() => void reviewReservation(false)}>Từ chối</button><button type="button" onClick={() => setDecision({ id: "", start: "", end: "", reason: "" })}>Đóng</button></form>}
    {feedback.error && <p className="facility-calendar__error" role="alert">{feedback.error}</p>}{feedback.notice && <p className="facility-calendar__notice" role="status">{feedback.notice}</p>}
  </section>;
}
