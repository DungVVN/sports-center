import { randomBytes } from "node:crypto";
import { AppError } from "../../shared/errors/app-error.js";

function invalidTime() { return new AppError({ statusCode: 422, code: "INVALID_CLASS_TIME", message: "Giờ kết thúc phải sau giờ bắt đầu." }); }
function scheduleConflict() { return new AppError({ statusCode: 422, code: "CLASS_SCHEDULE_CONFLICT", message: "Coach hoặc phòng học đã có lớp trùng thời gian." }); }

export function createClassService({ repository, auditService }) {
  return {
    list: () => repository.list(), changes: (status) => repository.changes(status), rooms: () => repository.rooms(), coaches: () => repository.coaches(),
    async create(input, actorUserId) {
      if (!await repository.findRoom(input.roomId)) throw new AppError({ statusCode: 422, code: "ROOM_NOT_FOUND", message: "Không tìm thấy phòng học." });
      if (!await repository.findCoach(input.coachUserId)) throw new AppError({ statusCode: 422, code: "COACH_NOT_AVAILABLE", message: "Huấn luyện viên không khả dụng." });
      const startsAt = new Date(input.startsAt); const endsAt = new Date(input.endsAt);
      if (endsAt <= startsAt) throw invalidTime();
      if (await repository.hasScheduleConflict(input.roomId, input.coachUserId, startsAt, endsAt)) throw scheduleConflict();
      const result = await repository.create({ code: `CLS-${randomBytes(4).toString("hex").toUpperCase()}`, name: input.name, type: input.type, description: input.description ?? null, coach_user_id: input.coachUserId, room_id: input.roomId, starts_at: startsAt, ends_at: endsAt, capacity: input.capacity, created_by: actorUserId });
      await auditService.record({ actorUserId, action: "class.created", entityType: "class_session", entityId: result.id, summary: "Đã tạo lớp học ở trạng thái nháp." });
      return result;
    },
    async update(id, input, actorUserId) {
      const current = await repository.find(id);
      if (!current) throw new AppError({ statusCode: 404, code: "CLASS_NOT_FOUND", message: "Không tìm thấy lớp học." });
      if (input.roomId && !await repository.findRoom(input.roomId)) throw new AppError({ statusCode: 422, code: "ROOM_NOT_FOUND", message: "Không tìm thấy phòng học." });
      if (input.coachUserId && !await repository.findCoach(input.coachUserId)) throw new AppError({ statusCode: 422, code: "COACH_NOT_AVAILABLE", message: "Huấn luyện viên không khả dụng." });
      const startsAt = input.startsAt ? new Date(input.startsAt) : current.starts_at; const endsAt = input.endsAt ? new Date(input.endsAt) : current.ends_at; const roomId = input.roomId ?? current.room_id; const coachUserId = input.coachUserId ?? current.coach_user_id;
      if (endsAt <= startsAt) throw invalidTime();
      if (await repository.hasScheduleConflict(roomId, coachUserId, startsAt, endsAt, id)) throw scheduleConflict();
      const result = await repository.update(id, { ...(input.name !== undefined && { name: input.name }), ...(input.type !== undefined && { type: input.type }), ...(input.description !== undefined && { description: input.description || null }), ...(input.coachUserId !== undefined && { coach_user_id: input.coachUserId }), ...(input.roomId !== undefined && { room_id: input.roomId }), ...(input.startsAt !== undefined && { starts_at: startsAt }), ...(input.endsAt !== undefined && { ends_at: endsAt }), ...(input.capacity !== undefined && { capacity: input.capacity }), ...(input.status && { status: input.status }) });
      await auditService.record({ actorUserId, action: "class.updated", entityType: "class_session", entityId: id, summary: "Đã cập nhật lớp học." });
      return result;
    },
    async publish(id, actorUserId) { return this.update(id, { status: "published" }, actorUserId); },
    async requestChange(classId, input, actorUserId) {
      const session = await repository.find(classId);
      if (!session || session.coach_user_id !== actorUserId || session.status !== "published") throw new AppError({ statusCode: 403, code: "CLASS_CHANGE_NOT_ALLOWED", message: "Chỉ coach phụ trách lớp đang công bố mới được đề xuất thay đổi." });
      const startsAt = input.startsAt ? new Date(input.startsAt) : null; const endsAt = input.endsAt ? new Date(input.endsAt) : null;
      if (input.type === "reschedule") { if (!startsAt || !endsAt || endsAt <= startsAt) throw invalidTime(); if (await repository.hasScheduleConflict(session.room_id, session.coach_user_id, startsAt, endsAt, classId)) throw scheduleConflict(); }
      const result = await repository.createChange({ class_session_id: classId, type: input.type, proposed_starts_at: startsAt, proposed_ends_at: endsAt, reason: input.reason, requested_by: actorUserId });
      await auditService.record({ actorUserId, action: "class.change_requested", entityType: "class_session", entityId: classId, summary: "Coach đã đề xuất thay đổi lớp.", reason: input.reason });
      return result;
    },
    async reviewChange(id, approved, actorUserId) {
      const change = await repository.change(id);
      if (!change || change.status !== "pending") throw new AppError({ statusCode: 422, code: "CLASS_CHANGE_UNAVAILABLE", message: "Yêu cầu thay đổi không còn chờ duyệt." });
      if (approved) {
        const session = await repository.find(change.class_session_id);
        if (!session || session.status !== "published") throw new AppError({ statusCode: 422, code: "CLASS_CHANGE_UNAVAILABLE", message: "Lớp học không còn đủ điều kiện để thay đổi." });
        if (change.type === "cancel") await repository.update(change.class_session_id, { status: "cancelled" });
        else { if (!change.proposed_starts_at || !change.proposed_ends_at || change.proposed_ends_at <= change.proposed_starts_at) throw invalidTime(); if (await repository.hasScheduleConflict(session.room_id, session.coach_user_id, change.proposed_starts_at, change.proposed_ends_at, session.id)) throw scheduleConflict(); await repository.update(change.class_session_id, { starts_at: change.proposed_starts_at, ends_at: change.proposed_ends_at }); }
        await repository.cancelBookings(change.class_session_id);
        await repository.notifyClassMembers(change.class_session_id, change.type === "cancel" ? "Lớp học đã hủy" : "Lớp học đã đổi lịch", change.type === "cancel" ? "Booking đã được hủy, bạn không bị tính phạt." : "Booking đã được hủy để bạn chọn lại lịch phù hợp, bạn không bị tính phạt.");
      } else {
        await repository.notifyUser(change.requested_by, "Yêu cầu thay đổi lớp bị từ chối", "Lễ tân chưa phê duyệt yêu cầu thay đổi lớp của bạn.", `/classes/${change.class_session_id}`);
      }
      const result = await repository.reviewChange(id, approved ? "approved" : "rejected", actorUserId);
      await auditService.record({ actorUserId, action: approved ? "class.change_approved" : "class.change_rejected", entityType: "class_session", entityId: change.class_session_id, summary: approved ? "Đã duyệt thay đổi lớp và thông báo hội viên." : "Đã từ chối thay đổi lớp và thông báo Coach." });
      return result;
    },
  };
}
