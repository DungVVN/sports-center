const areas = [
  ["/admin/site/pages", "trang website"], ["/admin/site/menus", "menu website"], ["/admin/site/media", "ảnh website"],
  ["/admin/permissions", "phân quyền"], ["/courses", "khóa học"], ["/course-enrollments", "đăng ký khóa học"],
  ["/pt-packages", "gói PT"], ["/pt-purchases", "đăng ký PT"], ["/pt-appointments", "buổi PT"],
  ["/facilities", "sân/phòng"], ["/facility-types", "loại sân/phòng"], ["/facility-days", "ngày mở sân"], ["/facility-reservations", "đặt sân/phòng"],
  ["/service-refunds", "hoàn tiền dịch vụ"], ["/payments", "thanh toán"],
  ["/members", "hội viên"], ["/staff", "nhân sự"], ["/packages", "gói tập"], ["/memberships", "gói hội viên"],
  ["/classes", "lớp học"], ["/bookings", "đặt chỗ"], ["/attendance", "điểm danh"], ["/training", "giáo án"],
  ["/assignments", "phân công"], ["/support", "hỗ trợ"], ["/auth", "tài khoản"], ["/notification-preferences", "cài đặt thông báo"],
];
const actions = { publish: "Công bố", restore: "Khôi phục", cancel: "Hủy", "staff-cancel": "Hủy", approve: "Duyệt", reject: "Từ chối", complete: "Hoàn thành", availability: "Cập nhật trạng thái", draft: "Lưu bản nháp" };

export function createOperationNotificationService({ repository }) {
  return {
    async record({ method, path, actor, result }) {
      if (!actor || !["POST", "PUT", "PATCH", "DELETE"].includes(method)) return;
      if (/^\/notifications(?:\/|$)/.test(path) || /\/(?:signature|login|logout|refresh|verify)$/.test(path)) return;
      // Attendance is announced once for the class, only after the bulk submission commits.
      if (/^\/attendance(?:\/|$)/.test(path)) return;
      if (/^\/classes\/[^/]+\/attendance\/submit$/.test(path)) {
        if (result?.alreadySubmitted) return;
        await repository.publishForActorAndAdmins(actor.id, { title: "Đã chốt điểm danh lớp học", body: `${actor.displayName ?? actor.display_name ?? "Người dùng"} đã lưu điểm danh cho cả lớp.`, link_path: null });
        return;
      }
      const area = areas.find(([prefix]) => path.startsWith(prefix))?.[1] ?? "dữ liệu hệ thống";
      const action = method === "DELETE" ? "Xóa" : actions[path.split("/").at(-1)] ?? "Cập nhật";
      await repository.publishForActorAndAdmins(actor.id, { title: `${action} ${area} thành công`, body: `${actor.displayName ?? actor.display_name ?? "Người dùng"} đã thực hiện thao tác này.`, link_path: null });
    },
  };
}
