import { prisma } from "../../database.js";

const activeBookingStatuses = ["confirmed", "waitlisted", "attended", "absent"];
const activeAssignmentWhere = (coachId) => ({ coach_user_id: coachId, effective_from: { lte: new Date() }, OR: [{ effective_to: null }, { effective_to: { gte: new Date() } }] });

async function memberIdsInCoachScope(coachId) {
  const [assignments, classes] = await Promise.all([
    prisma.member_coach_assignments.findMany({ where: activeAssignmentWhere(coachId), select: { member_id: true } }),
    prisma.class_sessions.findMany({ where: { coach_user_id: coachId }, select: { id: true } }),
  ]);
  const classIds = classes.map((item) => item.id);
  const bookings = classIds.length ? await prisma.bookings.findMany({ where: { class_session_id: { in: classIds }, status: { in: activeBookingStatuses } }, select: { member_id: true } }) : [];
  return [...new Set([...assignments, ...bookings].map((item) => item.member_id))];
}

export const trainingRepository = {
  templates: () => prisma.training_plan_templates.findMany({ where: { is_active: true }, orderBy: { name: "asc" } }),
  template: (id) => prisma.training_plan_templates.findUnique({ where: { id } }),
  templateExercises: (id) => prisma.training_template_exercises.findMany({ where: { template_id: id }, orderBy: { position: "asc" } }),
  createTemplate: (data) => prisma.training_plan_templates.create({ data }),
  createTemplateExercises: (data) => prisma.training_template_exercises.createMany({ data }),
  member: (id) => prisma.members.findUnique({ where: { id } }),
  memberByUser: (userId) => prisma.members.findUnique({ where: { user_id: userId }, select: { id: true } }),
  members: () => prisma.members.findMany({ orderBy: { full_name: "asc" }, select: { id: true, full_name: true, member_code: true } }),
  membersForCoach: async (coachId) => prisma.members.findMany({ where: { id: { in: await memberIdsInCoachScope(coachId) } }, orderBy: { full_name: "asc" }, select: { id: true, full_name: true, member_code: true } }),
  assigned: async (memberId, coachId) => (await memberIdsInCoachScope(coachId)).includes(memberId),
  plan: (id) => prisma.training_plans.findUnique({ where: { id } }),
  plans: (memberId) => prisma.training_plans.findMany({ where: memberId ? { member_id: memberId } : undefined, orderBy: { starts_on: "desc" } }),
  plansForMembers: (memberIds) => prisma.training_plans.findMany({ where: { member_id: { in: memberIds } }, orderBy: { starts_on: "desc" } }),
  createPlan: (data) => prisma.training_plans.create({ data }),
  updatePlan: (id, data) => prisma.training_plans.update({ where: { id }, data }),
  sessions: (planId) => prisma.training_sessions.findMany({ where: { plan_id: planId }, orderBy: { position: "asc" } }),
  session: (id) => prisma.training_sessions.findUnique({ where: { id } }),
  createSession: (data) => prisma.training_sessions.create({ data }),
  updateSession: (id, data) => prisma.training_sessions.update({ where: { id }, data }),
  sessionExercises: (sessionId) => prisma.training_session_exercises.findMany({ where: { session_id: sessionId }, orderBy: { position: "asc" } }),
  replaceSessionExercises: async (sessionId, exercises) => prisma.$transaction(async (tx) => { await tx.training_session_exercises.deleteMany({ where: { session_id: sessionId } }); await tx.training_session_exercises.createMany({ data: exercises.map((item, index) => ({ session_id: sessionId, position: index + 1, ...item })) }); }),
  reorderSessions: async (planId, ids) => prisma.$transaction(async (tx) => { await Promise.all(ids.map((id, index) => tx.training_sessions.update({ where: { id }, data: { position: -(index + 1) } }))); await Promise.all(ids.map((id, index) => tx.training_sessions.update({ where: { id }, data: { position: index + 1 } }))); return tx.training_sessions.findMany({ where: { plan_id: planId }, orderBy: { position: "asc" } }); }),
  reorderSessionExercises: async (sessionId, ids) => prisma.$transaction(async (tx) => { await Promise.all(ids.map((id, index) => tx.training_session_exercises.update({ where: { id }, data: { position: -(index + 1) } }))); await Promise.all(ids.map((id, index) => tx.training_session_exercises.update({ where: { id }, data: { position: index + 1 } }))); return tx.training_session_exercises.findMany({ where: { session_id: sessionId }, orderBy: { position: "asc" } }); }),
  replaceExercises: async (planId, exercises) => prisma.$transaction(async (tx) => {
    await tx.training_plan_exercises.deleteMany({ where: { plan_id: planId } });
    if (exercises.length) await tx.training_plan_exercises.createMany({ data: exercises.map((item, index) => ({ plan_id: planId, position: index + 1, ...item })) });
  }),
  createResult: (data) => prisma.training_results.create({ data }),
  results: (memberId) => prisma.training_results.findMany({ where: { member_id: memberId }, orderBy: { recorded_on: "desc" } }),
};
