import { AppError } from "../../../shared/errors/app-error.js";

export function createAttendanceService({ repository, auditService }) {
  async function ensureCoachScope(classId, actor) {
    const session = await repository.classSession(classId);
    if (
      actor.role === "coach" &&
      (!session || session.coach_user_id !== actor.id)
    )
      throw new AppError({
        statusCode: 403,
        code: "ATTENDANCE_SCOPE_DENIED",
        message: "Coach chỉ có thể thao tác điểm danh cho lớp mình phụ trách.",
      });
    return session;
  }
  function ensureSessionWindow(session, now = new Date()) {
    if (!session || now < session.starts_at || now > session.ends_at)
      throw new AppError({
        statusCode: 422,
        code: "ATTENDANCE_OUTSIDE_SESSION",
        message: "Chỉ có thể điểm danh trong thời gian diễn ra buổi học.",
      });
  }
  return {
    async list(classId, actor) {
      await ensureCoachScope(classId, actor);
      return repository.records(classId);
    },
    async ownRecords(actor) {
      const member = await repository.memberByUser(actor.id);
      if (!member)
        throw new AppError({
          statusCode: 404,
          code: "MEMBER_PROFILE_NOT_FOUND",
          message: "Tài khoản chưa có hồ sơ hội viên.",
        });
      return repository.recordsForMember(member.id);
    },
    async submit(classId, entries, actor) {
      const session = await ensureCoachScope(classId, actor);
      ensureSessionWindow(session);
      const result = await repository.submit(classId, entries, actor.id);
      if (result.pendingCount) throw new AppError({ statusCode: 422, code: "ATTENDANCE_NOT_COMPLETE", message: `Còn ${result.pendingCount} hội viên chưa được điểm danh.` });
      if (!result.alreadySubmitted) await auditService.record({ actorUserId: actor.id, action: "attendance.submitted", entityType: "class_session", entityId: classId, summary: "Đã chốt điểm danh và gửi thông báo cho hội viên." });
      return result;
    },
    async checkIn(bookingId, actor) {
      const booking = await repository.booking(bookingId);
      if (!booking || !["confirmed", "attended"].includes(booking.status))
        throw new AppError({
          statusCode: 422,
          code: "BOOKING_NOT_ELIGIBLE",
          message: "Booking không đủ điều kiện điểm danh.",
        });
      const session = await ensureCoachScope(booking.class_session_id, actor);
      ensureSessionWindow(session);
      const record = await repository.upsert({
        classSessionId: booking.class_session_id,
        memberId: booking.member_id,
        bookingId,
        status: "present",
        checkedInAt: new Date(),
        actor: actor.id,
      });
      await auditService.record({
        actorUserId: actor.id,
        action: "attendance.checked_in",
        entityType: "attendance",
        entityId: record.id,
        summary: "Đã điểm danh buổi học.",
      });
      return record;
    },
    async checkOut(attendanceId, actor) {
      const current = await repository.record(attendanceId);
      if (!current || current.status !== "present" || !current.checked_in_at)
        throw new AppError({
          statusCode: 422,
          code: "ATTENDANCE_CHECKOUT_NOT_ELIGIBLE",
          message: "Chỉ có thể check-out một lượt điểm danh đã check-in.",
        });
      if (current.checked_out_at)
        throw new AppError({
          statusCode: 409,
          code: "ATTENDANCE_ALREADY_CHECKED_OUT",
          message: "Buổi học này đã check-out.",
        });
      await ensureCoachScope(current.class_session_id, actor);
      const record = await repository.checkOut(attendanceId, actor.id);
      await auditService.record({
        actorUserId: actor.id,
        action: "attendance.checked_out",
        entityType: "attendance",
        entityId: attendanceId,
        summary: "Đã check-out buổi học.",
      });
      return record;
    },
    async correct(attendanceId, newStatus, reason, actor) {
      const current = await repository.record(attendanceId);
      if (!current)
        throw new AppError({
          statusCode: 404,
          code: "ATTENDANCE_NOT_FOUND",
          message: "Không tìm thấy điểm danh.",
        });
      const session = await ensureCoachScope(current.class_session_id, actor);
      const now = new Date();
      if (!session || now < session.starts_at)
        throw new AppError({
          statusCode: 422,
          code: "ATTENDANCE_CORRECTION_TOO_EARLY",
          message: "Chỉ có thể sửa điểm danh từ khi buổi học bắt đầu.",
        });
      const trimmedReason = reason?.trim();
      if (now > session.ends_at && !trimmedReason)
        throw new AppError({
          statusCode: 422,
          code: "ATTENDANCE_CORRECTION_REASON_REQUIRED",
          message: "Cần nhập lý do khi sửa điểm danh sau giờ học.",
        });
      const correctionReason =
        trimmedReason ?? "Điều chỉnh trong thời gian buổi học.";
      await repository.correct({
        attendance_id: attendanceId,
        previous_status: current.status,
        new_status: newStatus,
        reason: correctionReason,
        requested_by: actor.id,
      });
      const record = await repository.upsert({
        classSessionId: current.class_session_id,
        memberId: current.member_id,
        bookingId: current.booking_id,
        status: newStatus,
        checkedInAt: current.checked_in_at,
        actor: actor.id,
      });
      await auditService.record({
        actorUserId: actor.id,
        action: "attendance.corrected",
        entityType: "attendance",
        entityId: attendanceId,
        summary: "Đã sửa điểm danh.",
        reason: trimmedReason,
      });
      return record;
    },
  };
}
