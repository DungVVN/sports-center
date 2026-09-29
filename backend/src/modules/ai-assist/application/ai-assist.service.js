import { AppError } from "../../../shared/errors/app-error.js";

export function createAiAssistService({ repository, auditService }) {
  return {
    async suggestions(actor) {
      const [classes, plans, bookings, attendance, expiringMembers] = await Promise.all([repository.coachClasses(actor.id), repository.stalePlans(actor.id), repository.upcomingBookings(actor.id), repository.attendancePending(actor.id), repository.expiringMembers(actor.id)]);
      const suggestions = [
        ...classes.map((item) => ({ subject: `Nhắc lịch lớp ${item.name}`, body: `Kiểm tra danh sách hội viên trước buổi ${item.starts_at.toLocaleString("vi-VN")}.` })),
        ...bookings.filter((item) => item.booking_count > 0).map((item) => ({ subject: `Rà booking lớp ${item.name}`, body: `Lớp có ${item.booking_count} booking đang chờ diễn ra; Coach cần tự rà danh sách trước giờ học.` })),
        ...attendance.map((item) => ({ subject: `Điểm danh chưa nộp: ${item.name}`, body: "Buổi học đã kết thúc nhưng chưa có điểm danh; hãy kiểm tra và nộp theo quy trình." })),
        ...plans.map((item) => ({ subject: `Cập nhật giáo án ${item.name}`, body: "Giáo án chưa cập nhật trong 14 ngày; hãy rà lại trước khi chia sẻ với hội viên." })),
        ...expiringMembers.map((item) => ({ subject: `Gói tập sắp hết hạn: ${item.member_name}`, body: `Gói tập hết hạn vào ${item.expires_on.toLocaleDateString("vi-VN")}; chỉ dùng như lời nhắc để Coach trao đổi phù hợp, không thay thế tư vấn cá nhân.` })),
      ];
      return [{ type: "coach_review_required", label: "Bản nháp AI — cần Coach duyệt trước khi gửi", suggestions }];
    },
    async deliver(input, actor) {
      const member = actor.role === "coach" ? await repository.memberForCoach(input.memberId, actor.id) : await repository.member(input.memberId);
      if (!member?.user_id) throw new AppError({ statusCode: 403, code: "AI_ASSIST_MEMBER_SCOPE_DENIED", message: "Hội viên không tồn tại hoặc ngoài phạm vi được phép." });
      const delivery = await repository.createDelivery({ coachUserId: actor.id, memberId: member.id, memberUserId: member.user_id, subject: input.subject, body: input.body });
      await auditService.record({ actorUserId: actor.id, action: "ai_suggestion.delivered", entityType: "ai_suggestion_delivery", entityId: delivery.id, summary: "Coach đã duyệt và gửi hướng dẫn AI cho hội viên." });
      return delivery;
    },
  };
}
