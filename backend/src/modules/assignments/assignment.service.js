import { AppError } from "../../shared/errors/app-error.js";

export function createAssignmentService({ repository, auditService }) {
  return {
    list: (memberId) => repository.list(memberId),
    async assign(memberId, input, actorId) {
      const coach = await repository.coach(input.coachUserId);
      if (!coach || coach.role !== "coach" || coach.status !== "active") throw new AppError({ statusCode: 422, code: "COACH_NOT_AVAILABLE", message: "Huấn luyện viên không khả dụng." });
      const created = await repository.assign(memberId, coach.id, actorId, new Date(input.effectiveFrom), input.reason ?? null);
      await auditService.record({ actorUserId: actorId, action: "member.coach_assigned", entityType: "member", entityId: memberId, summary: "Đã thay đổi coach chính của hội viên.", reason: input.reason });
      return created;
    },
  };
}
