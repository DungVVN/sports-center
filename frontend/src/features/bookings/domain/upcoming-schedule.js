const dateTime = (value) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
const minuteTime = (value) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

export function upcomingSchedule(bookings, reservations, now) {
  const classEvents = bookings.filter((booking) => ["confirmed", "waitlisted"].includes(booking.status) && new Date(booking.class_session?.starts_at).getTime() > now).map((booking) => ({
    id: `class-${booking.id}`,
    startsAt: new Date(booking.class_session.starts_at).getTime(),
    title: booking.class_session.name,
    detail: booking.class_session.pt_purchase_id ? "Huấn luyện cá nhân · Đã xác nhận" : booking.status === "confirmed" ? "Lớp tập · Đã xác nhận" : "Lớp tập · Đang chờ chỗ, chưa được xác nhận",
    time: dateTime(booking.class_session.starts_at),
    target: booking.class_session.pt_purchase_id ? "pt" : "bookings",
  }));
  const facilityEvents = reservations.filter((reservation) => ["pending", "approved"].includes(reservation.status)).map((reservation) => {
    const start = reservation.assignedStartMinute ?? reservation.requestedStartMinute;
    const end = reservation.assignedEndMinute ?? reservation.requestedEndMinute;
    return {
      id: `facility-${reservation.id}`,
      startsAt: new Date(`${reservation.date}T${minuteTime(start)}:00+07:00`).getTime(),
      title: reservation.facilityName,
      detail: `Đặt sân · ${reservation.status === "approved" ? "Đã duyệt" : "Chờ duyệt"}${reservation.cancellationPending ? " · Có yêu cầu xác nhận hủy" : ""}`,
      time: `${new Date(`${reservation.date}T00:00:00+07:00`).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · ${minuteTime(start)}–${minuteTime(end)}`,
      target: "facility-calendar",
    };
  }).filter((event) => event.startsAt > now);
  return [...classEvents, ...facilityEvents].sort((left, right) => left.startsAt - right.startsAt);
}
