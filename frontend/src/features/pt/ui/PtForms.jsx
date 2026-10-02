import { useState } from "react";
import { Button } from "../../../shared/ui/Button.jsx";
const initial = { name: "", description: "", priceVnd: "", sessionCount: "", durationDays: "", sessionMinutes: "60", cancellationHours: "5" };
export function PtPackageForm({ onSubmit, pending }) {
  const [form, setForm] = useState(initial);
  const fields = [["name", "Tên gói", "text", null, null], ["priceVnd", "Giá trọn gói (đ)", "number", 0, 1000000000000], ["sessionCount", "Số buổi", "number", 1, 500], ["durationDays", "Hạn dùng từ khi kích hoạt (ngày)", "number", 1, 730], ["sessionMinutes", "Thời lượng mỗi buổi (phút)", "number", 15, 240], ["cancellationHours", "Tự hủy trước giờ tập ít nhất (giờ)", "number", 0, 168]];
  return <form className="pt-form" onSubmit={async (event) => {
    event.preventDefault();
    const input = { ...form };
    for (const key of ["sessionCount", "durationDays", "sessionMinutes", "cancellationHours"]) input[key] = Number(input[key]);
    if (await onSubmit({ action: "create", input })) setForm(initial);
  }}>
    <h2>Tạo gói PT</h2>
    {fields.map(([key, label, type, min, max]) => <label key={key}>{label}<input required type={type} min={min ?? undefined} max={max ?? undefined} minLength={type === "text" ? 2 : undefined} maxLength={type === "text" ? 120 : undefined} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}
    <Button type="submit" loading={pending}>Lưu gói PT</Button>
  </form>;
}
export function PtBookingForm({ purchase, rooms, onSubmit, pending }) {
  const [form, setForm] = useState({ roomId: "", startsAt: "" });
  return <form className="pt-form" onSubmit={async (event) => {
    event.preventDefault();
    if (await onSubmit({ action: "book", id: purchase.id, input: { roomId: form.roomId, startsAt: new Date(`${form.startsAt}+07:00`).toISOString() } })) setForm({ roomId: "", startsAt: "" });
  }}>
    <label>Phòng<select required value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value })}><option value="">Chọn phòng</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
    <label>Bắt đầu (giờ Việt Nam)<input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
    <p>Mỗi buổi {purchase.session_minutes_snapshot} phút. Hủy trước ít nhất {purchase.cancellation_hours_snapshot} giờ.</p>
    <Button type="submit" loading={pending}>Đặt một buổi PT</Button>
  </form>;
}
export function PtDecisionForm({ appointment, canCancel, canComplete, onSubmit, pending }) {
  const [reason, setReason] = useState("");
  return <div className="pt-form">
    <label>Lý do / nhận xét<input required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    {canCancel && <Button variant="ghost" loading={pending} disabled={reason.trim().length < 3} onClick={() => onSubmit({ action: "cancel", id: appointment.id, input: { reason } })}>Hủy và trả lại buổi</Button>}
    {canComplete && ["completed", "absent"].map((status) => <Button key={status} loading={pending} disabled={reason.trim().length < 3} onClick={() => onSubmit({ action: "complete", id: appointment.id, input: { status, reason } })}>{status === "completed" ? "Ghi hoàn thành" : "Ghi vắng mặt"}</Button>)}
  </div>;
}
