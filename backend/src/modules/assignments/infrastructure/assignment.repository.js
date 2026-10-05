import { prisma } from "../../../database.js";
import { AppError } from "../../../shared/errors/app-error.js";

export const assignmentRepository = {
  list: (memberId) => prisma.member_coach_assignments.findMany({ where: { member_id: memberId }, orderBy: { effective_from: "desc" } }),
  member: (id) => prisma.members.findUnique({ where: { id }, select: { id: true } }),
  coach: (id) => prisma.users.findUnique({ where: { id } }),
  assign: (memberId, coachId, actorId, effectiveFrom, reason) => prisma.$transaction(async (tx) => {
    // Serialize changes for this member before closing the current date range.
    await tx.$queryRaw`SELECT id FROM members WHERE id = ${memberId}::uuid FOR UPDATE`;
    const current = await tx.member_coach_assignments.findFirst({ where: { member_id: memberId, effective_to: null } });
    if (current && current.effective_from >= effectiveFrom) {
      throw new AppError({ statusCode: 409, code: "COACH_ASSIGNMENT_DATE_CONFLICT", message: "Ngày hiệu lực mới phải sau ngày bắt đầu phân công hiện tại. Vui lòng tải lại lịch sử phân công." });
    }
    const previousEndsOn = new Date(effectiveFrom);
    previousEndsOn.setUTCDate(previousEndsOn.getUTCDate() - 1);
    await tx.member_coach_assignments.updateMany({ where: { member_id: memberId, effective_to: null }, data: { effective_to: previousEndsOn } });
    return tx.member_coach_assignments.create({ data: { member_id: memberId, coach_user_id: coachId, assigned_by: actorId, effective_from: effectiveFrom, reason } });
  }),
};
