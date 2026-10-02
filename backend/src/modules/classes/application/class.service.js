import { randomBytes } from "node:crypto";
import { AppError } from "../../../shared/errors/app-error.js";
import { violatesUniqueConstraint, retryOnUniqueConstraint } from "../../../shared/database/unique-constraint.js";

function invalidTime() { return new AppError({ statusCode: 422, code: "INVALID_CLASS_TIME", message: "Giờ kết thúc phải sau giờ bắt đầu." }); }
function scheduleConflict() { return new AppError({ statusCode: 422, code: "CLASS_SCHEDULE_CONFLICT", message: "Coach hoặc phòng học đã có lớp trùng thời gian." }); }
function classWriteError(error) {
  const message = `${error?.message ?? ""} ${error?.meta?.database_error ?? ""}`;
  if (/class_schedule_conflict_guard|Coach or room already has an overlapping class|Physical room is already occupied by a rental/.test(message)) return scheduleConflict();
  if (/class_room_capacity_guard|Class capacity exceeds room capacity/.test(message)) return new AppError({ statusCode: 422, code: "CLASS_ROOM_CAPACITY_EXCEEDED", message: "Sĩ số lớp không được vượt sức chứa của phòng học." });
  if (/class_occupied_capacity_guard|Class capacity is below occupied seats/.test(message)) return new AppError({ statusCode: 422, code: "CLASS_CAPACITY_BELOW_BOOKINGS", message: "Sĩ số lớp không được thấp hơn số chỗ đã xác nhận hoặc đã tham gia." });
  return error;
}

export function createClassService({ repository, auditService }) {
  async function validateResources(roomId, coachUserId, capacity) {
    const room = await repository.findRoom(roomId);
    if (!room || !room.is_active) throw new AppError({ statusCode: 422, code: "ROOM_NOT_FOUND", message: "Phòng học không khả dụng." });
    if (capacity > room.capacity) throw new AppError({ statusCode: 422, code: "CLASS_ROOM_CAPACITY_EXCEEDED", message: "Sĩ số lớp không được vượt sức chứa của phòng học." });
    if (!await repository.findCoach(coachUserId)) throw new AppError({ statusCode: 422, code: "COACH_NOT_AVAILABLE", message: "Huấn luyện viên không khả dụng." });
  }
  return {
    async list(actor) {
      const [classes, coaches] = await Promise.all([
        actor?.role === "coach" ? repository.listForCoach(actor.id) : repository.list(),
        repository.coaches(),
      ]);
      const coachNameById = new Map(coaches.map((coach) => [coach.id, coach.display_name]));
      return classes.map((item) => ({ ...item, coach_name: coachNameById.get(item.coach_user_id) ?? "Chưa phân công" }));
    },
    changes: (status) => repository.changes(status),
    rooms: () => repository.rooms(),
    async coaches(actor) {
      if (actor?.role === "coach") return repository.coach(actor.id);
      if (actor?.role === "member") return repository.coachesForMemberUser(actor.id);
      return repository.coaches();
    },
    async create(input, actorUserId) {
      await validateResources(input.roomId, input.coachUserId, input.capacity);
      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(input.endsAt);
      if (endsAt <= startsAt) throw invalidTime();
      if (await repository.hasScheduleConflict(input.roomId, input.coachUserId, startsAt, endsAt)) throw scheduleConflict();
      let result;
      try {
        result = await retryOnUniqueConstraint(() => repository.create({
          code: `CLS-${randomBytes(4).toString("hex").toUpperCase()}`,
          name: input.name,
          type: input.type,
          description: input.description ?? null,
          coach_user_id: input.coachUserId,
          room_id: input.roomId,
          starts_at: startsAt,
          ends_at: endsAt,
          capacity: input.capacity,
          created_by: actorUserId,
          ...(input.courseId && { course_id: input.courseId }),
        }), { fields: ["code"] });
      } catch (error) {
        if (violatesUniqueConstraint(error)) throw new AppError({ statusCode: 409, code: "CLASS_CODE_CONFLICT", message: "Không thể cấp mã lớp học. Vui lòng thử lại." });
        throw classWriteError(error);
      }
      await auditService.record({ actorUserId, action: "class.created", entityType: "class_session", entityId: result.id, summary: "Đã tạo lớp học ở trạng thái nháp." });
      return result;
    },
    async update(id, input, actorUserId) {
      const current = await repository.find(id);
      if (!current) throw new AppError({ statusCode: 404, code: "CLASS_NOT_FOUND", message: "Không tìm thấy lớp học." });
      if (current.pt_purchase_id) throw new AppError({ statusCode: 422, code: "PT_USE_APPOINTMENT_WORKFLOW", message: "Buổi PT cần được xử lý qua lịch PT." });
      const startsAt = input.startsAt ? new Date(input.startsAt) : current.starts_at;
      const endsAt = input.endsAt ? new Date(input.endsAt) : current.ends_at;
      const roomId = input.roomId ?? current.room_id;
      const coachUserId = input.coachUserId ?? current.coach_user_id;
      await validateResources(roomId, coachUserId, input.capacity ?? current.capacity);
      if (endsAt <= startsAt) throw invalidTime();
      const scheduleChanged = roomId !== current.room_id || coachUserId !== current.coach_user_id
        || new Date(startsAt).getTime() !== new Date(current.starts_at).getTime()
        || new Date(endsAt).getTime() !== new Date(current.ends_at).getTime()
        || (input.status !== undefined && input.status !== current.status);
      if (scheduleChanged && input.status !== "cancelled"
        && await repository.hasScheduleConflict(roomId, coachUserId, startsAt, endsAt, id)) throw scheduleConflict();
      let result;
      try {
        result = await repository.update(id, {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.type !== undefined && { type: input.type }),
          ...(input.description !== undefined && { description: input.description || null }),
          ...(input.coachUserId !== undefined && { coach_user_id: input.coachUserId }),
          ...(input.roomId !== undefined && { room_id: input.roomId }),
          ...(input.startsAt !== undefined && { starts_at: startsAt }),
          ...(input.endsAt !== undefined && { ends_at: endsAt }),
          ...(input.capacity !== undefined && { capacity: input.capacity }),
          ...(input.status && { status: input.status }),
        });
      } catch (error) {
        throw classWriteError(error);
      }
      await auditService.record({ actorUserId, action: "class.updated", entityType: "class_session", entityId: id, summary: "Đã cập nhật lớp học." });
      return result;
    },
    async publish(id, actorUserId) { return this.update(id, { status: "published" }, actorUserId); },
    async requestChange(classId, input, actor) {
      const session = await repository.find(classId);
      if (session?.pt_purchase_id) throw new AppError({ statusCode: 422, code: "PT_USE_APPOINTMENT_WORKFLOW", message: "Buổi PT cần được xử lý qua lịch PT." });
      if (!session || session.status !== "published" || (actor.role === "coach" && session.coach_user_id !== actor.id)) throw new AppError({ statusCode: 403, code: "CLASS_CHANGE_NOT_ALLOWED", message: "Không được đề xuất thay đổi lớp này." });
      const startsAt = input.startsAt ? new Date(input.startsAt) : null;
      const endsAt = input.endsAt ? new Date(input.endsAt) : null;
      if (input.type === "reschedule") {
        if (!startsAt || !endsAt || endsAt <= startsAt) throw invalidTime();
        if (await repository.hasScheduleConflict(session.room_id, session.coach_user_id, startsAt, endsAt, classId)) throw scheduleConflict();
      }
      const result = await repository.createChange({ class_session_id: classId, type: input.type, proposed_starts_at: startsAt, proposed_ends_at: endsAt, reason: input.reason, requested_by: actor.id });
      await auditService.record({ actorUserId: actor.id, action: "class.change_requested", entityType: "class_session", entityId: classId, summary: "Đã đề xuất thay đổi lớp.", reason: input.reason });
      return result;
    },
    async reviewChange(id, approved, actorUserId) {
      const change = await repository.change(id);
      if (!change || change.status !== "pending") throw new AppError({ statusCode: 422, code: "CLASS_CHANGE_UNAVAILABLE", message: "Yêu cầu thay đổi không còn chờ duyệt." });
      if (approved) {
        const session = await repository.find(change.class_session_id);
        if (!session || session.status !== "published") throw new AppError({ statusCode: 422, code: "CLASS_CHANGE_UNAVAILABLE", message: "Lớp học không còn đủ điều kiện để thay đổi." });
        if (change.type === "reschedule") {
          if (!change.proposed_starts_at || !change.proposed_ends_at || change.proposed_ends_at <= change.proposed_starts_at) throw invalidTime();
          if (await repository.hasScheduleConflict(session.room_id, session.coach_user_id, change.proposed_starts_at, change.proposed_ends_at, session.id)) throw scheduleConflict();
        }
      }
      const notification = approved ? {
        title: change.type === "cancel" ? "Lớp học đã hủy" : "Lớp học đã đổi lịch",
        body: change.type === "cancel" ? "Booking đã được hủy, bạn không bị tính phạt." : "Booking đã được hủy để bạn chọn lại lịch phù hợp, bạn không bị tính phạt.",
      } : {
        title: "Yêu cầu thay đổi lớp bị từ chối",
        body: "Lễ tân chưa phê duyệt yêu cầu thay đổi lớp của bạn.",
      };
      let result;
      try {
        result = await repository.reviewChange(id, approved ? "approved" : "rejected", actorUserId, {
          notification,
          audit: {
            action: approved ? "class.change_approved" : "class.change_rejected",
            summary: approved ? "Đã duyệt thay đổi lớp và xử lý booking còn hiệu lực." : "Đã từ chối thay đổi lớp và thông báo Coach.",
          },
        });
      } catch (error) {
        throw classWriteError(error);
      }
      return result;
    },
  };
}
