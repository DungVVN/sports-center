export const money = (value) => `${Number(value).toLocaleString("vi-VN")} đ`;
export const time = (value) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      })
    : "Chưa kích hoạt";
export const labels = {
  pending_payment: "Chờ thanh toán",
  active: "Đã kích hoạt",
  scheduled: "Đã đặt",
  completed: "Hoàn thành",
  absent: "Vắng mặt",
  cancelled: "Đã hủy",
};
