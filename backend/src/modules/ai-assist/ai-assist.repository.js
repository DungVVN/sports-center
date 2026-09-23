import { prisma } from "../../database.js";

const now = () => new Date();
const activeAssignmentWhere = (coachId) => ({ coach_user_id: coachId, effective_from: { lte: now() }, OR: [{ effective_to: null }, { effective_to: { gte: now() } }] });

export const aiAssistRepository = {
  member: (id) => prisma.members.findUnique({ where: { id }, select: { id: true, user_id: true, full_name: true } }),
  coachClasses: (coachId) => prisma.class_sessions.findMany({ where: { coach_user_id: coachId, starts_at: { gte: now() } }, orderBy: { starts_at: "asc" }, take: 5, select: { id: true, name: true, starts_at: true } }),
  stalePlans: (coachId) => prisma.training_plans.findMany({ where: { coach_user_id: coachId, status: "active", updated_at: { lt: new Date(Date.now() - 14 * 86400000) } }, select: { id: true, name: true } }),
  async upcomingBookings(coachId) {
    const classes = await prisma.class_sessions.findMany({ where: { coach_user_id: coachId, starts_at: { gte: now(), lte: new Date(Date.now() + 2 * 86400000) } }, select: { id: true, name: true, starts_at: true } });
    const counts = classes.length ? await prisma.bookings.groupBy({ by: ["class_session_id"], where: { class_session_id: { in: classes.map((item) => item.id) }, status: { in: ["confirmed", "waitlisted"] } }, _count: { id: true } }) : [];
    const countByClassId = new Map(counts.map((item) => [item.class_session_id, item._count.id]));
    return classes.map((item) => ({ ...item, booking_count: countByClassId.get(item.id) ?? 0 }));
  },
  async attendancePending(coachId) {
    const classes = await prisma.class_sessions.findMany({ where: { coach_user_id: coachId, ends_at: { gte: new Date(Date.now() - 7 * 86400000), lt: now() } }, select: { id: true, name: true, ends_at: true } });
    const submitted = classes.length ? await prisma.attendance_submissions.findMany({ where: { class_session_id: { in: classes.map((item) => item.id) } }, select: { class_session_id: true } }) : [];
    const submittedIds = new Set(submitted.map((item) => item.class_session_id));
    return classes.filter((item) => !submittedIds.has(item.id));
  },
  async expiringMembers(coachId) {
    const assignments = await prisma.member_coach_assignments.findMany({ where: activeAssignmentWhere(coachId), select: { member_id: true } });
    const memberIds = [...new Set(assignments.map((item) => item.member_id))];
    if (!memberIds.length) return [];
    const [members, memberships] = await Promise.all([
      prisma.members.findMany({ where: { id: { in: memberIds } }, select: { id: true, full_name: true } }),
      prisma.member_memberships.findMany({ where: { member_id: { in: memberIds }, status: { in: ["active", "expiring_soon"] }, expires_on: { gte: now(), lte: new Date(Date.now() + 7 * 86400000) } }, select: { member_id: true, expires_on: true } }),
    ]);
    const nameById = new Map(members.map((item) => [item.id, item.full_name]));
    return memberships.map((item) => ({ ...item, member_name: nameById.get(item.member_id) ?? "Hội viên" }));
  },
  async memberForCoach(memberId, coachId) {
    const member = await prisma.members.findUnique({ where: { id: memberId }, select: { id: true, user_id: true, full_name: true } });
    if (!member?.user_id) return null;
    const assigned = await prisma.member_coach_assignments.findFirst({ where: { member_id: memberId, ...activeAssignmentWhere(coachId) }, select: { id: true } });
    if (assigned) return member;
    const classes = await prisma.class_sessions.findMany({ where: { coach_user_id: coachId }, select: { id: true } });
    if (!classes.length) return null;
    const booking = await prisma.bookings.findFirst({ where: { member_id: memberId, class_session_id: { in: classes.map((item) => item.id) }, status: { in: ["confirmed", "waitlisted", "attended", "absent"] } }, select: { id: true } });
    return booking ? member : null;
  },
  createDelivery: (data) => prisma.$transaction(async (tx) => {
    const delivery = await tx.ai_suggestion_deliveries.create({ data: { coach_user_id: data.coachUserId, member_id: data.memberId, subject: data.subject, body: data.body } });
    await tx.notifications.create({ data: { recipient_user_id: data.memberUserId, category: "member", title: data.subject, body: data.body, link_path: "/training" } });
    return delivery;
  }),
};
