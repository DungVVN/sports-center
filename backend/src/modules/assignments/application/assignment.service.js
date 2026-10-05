import { AppError } from "../../../shared/errors/app-error.js";

export function createAssignmentService({ repository, auditService }) {
  return {
    async list(memberId) {
      if (!await repository.member(memberId)) throw new AppError({ statusCode: 404, code: "MEMBER_NOT_FOUND", message: "Không tìm thấy hội viên." });
      return repository.list(memberId);
    },
    async assign(memberId, input, actorId) {
      if (!await repository.member(memberId)) throw new AppError({ statusCode: 404, code: "MEMBER_NOT_FOUND", message: "Không tìm thấy hội viên." });
      const effectiveFrom = new Date(input.effectiveFrom);
      const today = new Date(Date.now() + 7 * 3600000); today.setUTCHours(0, 0, 0, 0);
      if (effectiveFrom < today) throw new AppError({ statusCode: 422, code: "COACH_ASSIGNMENT_DATE_INVALID", message: "Ngày hiệu lực không được nằm trong quá khứ." });
      const coach = await repository.coach(input.coachUserId);
      if (!coach || coach.role !== "coach" || coach.status !== "active") throw new AppError({ statusCode: 422, code: "COACH_NOT_AVAILABLE", message: "Huấn luyện viên không khả dụng." });
      const created = await repository.assign(memberId, coach.id, actorId, effectiveFrom, input.reason ?? null);
      await auditService.record({ actorUserId: actorId, action: "member.coach_assigned", entityType: "member", entityId: memberId, summary: "Đã thay đổi coach chính của hội viên.", reason: input.reason });
      return created;
    },
  };
}
