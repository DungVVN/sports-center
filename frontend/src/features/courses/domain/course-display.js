export const courseLabels = Object.freeze({
  draft: "Nháp",
  published: "Đang mở",
  pending_payment: "Chờ thanh toán",
  active: "Đang học",
  cancelled: "Đã hủy",
  completed: "Hoàn thành",
});
export const coursePrice = (value) =>
  `${Number(value).toLocaleString("vi-VN")} đ`;
export const courseTime = (value) =>
  new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  });
export function courseSessionInput(form) {
  return {
    name: form.name || undefined,
    coachUserId: form.coachUserId,
    roomId: form.roomId,
    startsAt: new Date(`${form.startsAt}+07:00`).toISOString(),
    endsAt: new Date(`${form.endsAt}+07:00`).toISOString(),
  };
}
