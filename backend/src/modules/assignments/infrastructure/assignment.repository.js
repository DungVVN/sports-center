import { prisma } from "../../../database.js";

export const assignmentRepository = {
  list: (memberId) => prisma.member_coach_assignments.findMany({ where: { member_id: memberId }, orderBy: { effective_from: "desc" } }),
  member: (id) => prisma.members.findUnique({ where: { id }, select: { id: true } }),
  coach: (id) => prisma.users.findUnique({ where: { id } }),
  assign: (memberId, coachId, actorId, effectiveFrom, reason) => prisma.$transaction(async (tx) => {
    const previousEndsOn = new Date(effectiveFrom);
    previousEndsOn.setUTCDate(previousEndsOn.getUTCDate() - 1);
    await tx.member_coach_assignments.updateMany({ where: { member_id: memberId, effective_to: null }, data: { effective_to: previousEndsOn } });
    return tx.member_coach_assignments.create({ data: { member_id: memberId, coach_user_id: coachId, assigned_by: actorId, effective_from: effectiveFrom, reason } });
  }),
};
