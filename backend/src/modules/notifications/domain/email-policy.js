// The bell keeps every notification; email uses a deliberately narrower set.
const importantTitles = new Set([
  "Đã có chỗ trong lớp",
  "Nhắc lịch học",
  "Lớp học đã hủy",
  "Lớp học đã đổi lịch",
  "Yêu cầu thay đổi lớp bị từ chối",
  "Đơn đặt sân đã được duyệt",
  "Đơn đặt sân bị từ chối",
  "Đã kích hoạt gói PT",
  "Đã phân công coach PT",
  "Có lịch PT mới",
  "Đã hủy lịch PT",
  "Yêu cầu đóng băng đã được duyệt",
  "Yêu cầu đóng băng bị từ chối",
  "Gói tập sắp hết hạn",
  "Gói tập đã hết hạn",
  "Nhắc gia hạn gói tập",
  "Gói tập đã hết hạn chính thức",
]);

export function shouldEmailNotification(notification) {
  if (notification.category === "system") return false;
  if (notification.category === "finance") return true;
  return importantTitles.has(notification.title)
    || notification.link_path === "/support" && /^Phản hồi yêu cầu /.test(notification.title);
}
