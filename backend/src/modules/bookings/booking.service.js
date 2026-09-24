import { randomBytes } from "node:crypto";
import { AppError } from "../../shared/errors/app-error.js";
import { violatesUniqueConstraint, retryOnUniqueConstraint } from "../../shared/database/unique-constraint.js";

const isMember = (actor) => actor.role === "member";

export function createBookingService({ repository, auditService }) {
  async function scopedMemberId(actor, requestedMemberId) {
    if (!isMember(actor)) return requestedMemberId;
    const member = await repository.memberByUser(actor.id);
    if (!member) throw new AppError({ statusCode: 404, code: "MEMBER_PROFILE_NOT_FOUND", message: "Không tìm thấy hồ sơ hội viên của tài khoản này." });
    if (requestedMemberId && requestedMemberId !== member.id) throw new AppError({ statusCode: 403, code: "BOOKING_ACCESS_DENIED", message: "Bạn chỉ có thể thao tác lịch của chính mình." });
    return member.id;
  }

  return {
    async list(memberId, actor) { return repository.list({ memberId: await scopedMemberId(actor, memberId), coachUserId: actor.role === "coach" ? actor.id : undefined }); },
    async listForClass(classId, actor) {
      const session = await repository.class(classId);
      if (!session) throw new AppError({ statusCode: 404, code: "CLASS_NOT_FOUND", message: "Không tìm thấy lớp học." });
      if (actor.role === "coach" && session.coach_user_id !== actor.id) throw new AppError({ statusCode: 403, code: "BOOKING_CLASS_SCOPE_DENIED", message: "Coach chỉ có thể xem booking của lớp mình phụ trách." });
      return repository.listForClass(classId, actor.role === "member" ? await scopedMemberId(actor) : undefined);
    },
    async create({ memberId: requestedMemberId, classId }, actor) {
      const memberId = await scopedMemberId(actor, requestedMemberId);
      if (!memberId || !await repository.member(memberId)) throw new AppError({ statusCode: 404, code: "MEMBER_NOT_FOUND", message: "Không tìm thấy hội viên." });
      const session = await repository.class(classId);
      if (!session || session.status !== "published" || session.starts_at <= new Date()) throw new AppError({ statusCode: 422, code: "CLASS_UNAVAILABLE", message: "Lớp học chưa sẵn sàng để đặt chỗ." });
      const membership = await repository.activeMembership(memberId, session.starts_at);
      const access = membership && await repository.entitlement(membership.package_id);
      if (!access) throw new AppError({ statusCode: 422, code: "MEMBERSHIP_BOOKING_NOT_ELIGIBLE", message: "Gói tập không còn hiệu lực vào thời điểm lớp diễn ra hoặc không có quyền đặt lớp." });
      let result;
      try {
        result = await retryOnUniqueConstraint(() => repository.createWithCapacity({ bookingCode: `BKG-${randomBytes(4).toString("hex").toUpperCase()}`, memberId, classId, bookedBy: actor.id }), { fields: ["booking_code"] });
      } catch (error) {
        if (violatesUniqueConstraint(error)) throw new AppError({ statusCode: 409, code: "BOOKING_CREATION_CONFLICT", message: "Không thể tạo mã đặt chỗ. Vui lòng thử lại." });
        throw error;
      }
      if (result.duplicate) throw new AppError({ statusCode: 409, code: "BOOKING_ALREADY_EXISTS", message: "Hội viên đã có đặt chỗ còn hiệu lực cho lớp này." });
      await auditService.record({ actorUserId: actor.id, action: "booking.created", entityType: "booking", entityId: result.booking.id, summary: result.booking.status === "waitlisted" ? "Đã vào danh sách chờ." : "Đã đặt chỗ lớp học." });
      return result.booking;
    },
    async cancel(id, reason, actor) {
      const booking = await repository.find(id);
      if (!booking || booking.status === "cancelled") throw new AppError({ statusCode: 404, code: "BOOKING_NOT_FOUND", message: "Không tìm thấy đặt chỗ còn hiệu lực." });
      const memberId = await scopedMemberId(actor);
      if (isMember(actor) && booking.member_id !== memberId) throw new AppError({ statusCode: 403, code: "BOOKING_ACCESS_DENIED", message: "Bạn chỉ có thể hủy lịch của chính mình." });
      const session = await repository.class(booking.class_session_id);
      if (!session || (isMember(actor) && session.starts_at.getTime() - Date.now() < 5 * 60 * 60 * 1000)) throw new AppError({ statusCode: 422, code: "BOOKING_CANCELLATION_TOO_LATE", message: "Hội viên chỉ được tự hủy trước giờ học ít nhất 5 giờ." });
      const result = await repository.cancel(id, reason);
      const promoted = booking.status === "confirmed" ? await repository.promoteWaitlisted(booking.class_session_id) : null;
      await auditService.record({ actorUserId: actor.id, action: "booking.cancelled", entityType: "booking", entityId: id, summary: promoted ? "Đã hủy booking và tự động xác nhận danh sách chờ." : "Đã hủy đặt chỗ lớp học.", reason });
      return { ...result, promotedBookingId: promoted?.id ?? null };
    },
  };
}
