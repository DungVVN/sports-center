import { useState } from "react";
import { Button } from "../../../shared/ui/Button.jsx";
import { courseSessionInput } from "../domain/course-display.js";

export function CourseCreateForm({ mutation, onSubmit }) {
  const [form, setForm] = useState({ name: "", description: "", priceVnd: "", capacity: "", paymentHoldMinutes: "60" });
  const field = (name) => ({ value: form[name], onChange: (event) => setForm({ ...form, [name]: event.target.value }) });
  return (
    <form className="course-form" onSubmit={async (event) => {
      event.preventDefault();
      if (await onSubmit({ action: "create", input: { ...form, capacity: Number(form.capacity), paymentHoldMinutes: Number(form.paymentHoldMinutes) } })) setForm({ name: "", description: "", priceVnd: "", capacity: "", paymentHoldMinutes: "60" });
    }}>
      <h2>Tạo khóa học</h2>
      <label>Tên khóa<input required minLength={2} maxLength={120} {...field("name")} /></label>
      <label>Mô tả<textarea maxLength={1000} {...field("description")} /></label>
      <label>Học phí trọn khóa (đ)<input required type="number" min="0" max="1000000000000" step="1" {...field("priceVnd")} /></label>
      <label>Sĩ số<input required type="number" min="1" max="500" step="1" {...field("capacity")} /></label>
      <label>Thời gian giữ chỗ chờ thanh toán (phút)<input required type="number" min="5" max="1440" step="1" {...field("paymentHoldMinutes")} /></label>
      <Button type="submit" loading={mutation.isPending}>Tạo khóa nháp</Button>
    </form>
  );
}

export function CourseSessionForm({ course, rooms, coaches, mutation, onSubmit }) {
  const [form, setForm] = useState({ name: "", roomId: "", coachUserId: "", startsAt: "", endsAt: "" });
  const field = (name) => ({ value: form[name], onChange: (event) => setForm({ ...form, [name]: event.target.value }) });
  return (
    <form className="course-form" onSubmit={async (event) => {
      event.preventDefault();
      if (form.endsAt <= form.startsAt) { event.currentTarget.querySelector('[name="endsAt"]').setCustomValidity("Giờ kết thúc phải sau giờ bắt đầu."); event.currentTarget.reportValidity(); return; }
      if (await onSubmit({ action: "session", id: course.id, input: courseSessionInput(form) })) setForm({ name: "", roomId: "", coachUserId: "", startsAt: "", endsAt: "" });
    }}>
      <h3>Thêm buổi cho {course.name}</h3>
      <label>Tên buổi (để trống dùng tên khóa)<input maxLength={120} {...field("name")} /></label>
      <label>Phòng<select required {...field("roomId")}><option value="">Chọn phòng</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.capacity} chỗ</option>)}</select></label>
      <label>Coach<select required {...field("coachUserId")}><option value="">Chọn coach</option>{coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.display_name}</option>)}</select></label>
      <label>Bắt đầu (giờ Việt Nam)<input required type="datetime-local" {...field("startsAt")} /></label>
      <label>Kết thúc (giờ Việt Nam)<input required name="endsAt" type="datetime-local" {...field("endsAt")} onInput={(event) => event.target.setCustomValidity("")} /></label>
      <Button type="submit" loading={mutation.isPending}>Thêm buổi</Button>
    </form>
  );
}
