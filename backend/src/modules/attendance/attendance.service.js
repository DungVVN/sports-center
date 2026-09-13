import { AppError } from "../../shared/errors/app-error.js";

export function createAttendanceService({ repository, auditService }) {
  return {
    list: (classId) => repository.records(classId),
    async checkIn(bookingId, actor) {
      const booking = await repository.booking(bookingId);
      if (!booking || !["confirmed", "attended"].includes(booking.status)) throw new AppError({ statusCode: 422, code: "BOOKING_NOT_ELIGIBLE", message: "Booking không đủ điều kiện điểm danh." });
      const record = await repository.upsert({ classSessionId: booking.class_session_id, memberId: booking.member_id, bookingId, status: "present", checkedInAt: new Date(), actor });
      await auditService.record({ actorUserId: actor, action: "attendance.checked_in", entityType: "attendance", entityId: record.id, summary: "Đã điểm danh buổi học." });
      return record;
    },
    async checkOut(attendanceId, actor) {
      const current = await repository.record(attendanceId);
      if (!current || current.status !== "present" || !current.checked_in_at) throw new AppError({ statusCode: 422, code: "ATTENDANCE_CHECKOUT_NOT_ELIGIBLE", message: "Chỉ có thể check-out một lượt điểm danh đã check-in." });
      if (current.checked_out_at) throw new AppError({ statusCode: 409, code: "ATTENDANCE_ALREADY_CHECKED_OUT", message: "Buổi học này đã check-out." });
      const record = await repository.checkOut(attendanceId, actor);
      await auditService.record({ actorUserId: actor, action: "attendance.checked_out", entityType: "attendance", entityId: attendanceId, summary: "Đã check-out buổi học." });
      return record;
    },
    async correct(attendanceId, newStatus, reason, actor) {
      const current = await repository.record(attendanceId);
      if (!current) throw new AppError({ statusCode: 404, code: "ATTENDANCE_NOT_FOUND", message: "Không tìm thấy điểm danh." });
      await repository.correct({ attendance_id: attendanceId, previous_status: current.status, new_status: newStatus, reason, requested_by: actor });
      const record = await repository.upsert({ classSessionId: current.class_session_id, memberId: current.member_id, bookingId: current.booking_id, status: newStatus, checkedInAt: current.checked_in_at, actor });
      await auditService.record({ actorUserId: actor, action: "attendance.corrected", entityType: "attendance", entityId: attendanceId, summary: "Đã sửa điểm danh.", reason });
      return record;
    },
  };
}
