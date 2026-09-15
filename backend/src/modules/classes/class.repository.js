import { prisma } from "../../database.js";

export const classRepository = {
  list: () => prisma.class_sessions.findMany({ orderBy: { starts_at: "asc" } }),
  listForCoach: (coachUserId) => prisma.class_sessions.findMany({ where: { coach_user_id: coachUserId }, orderBy: { starts_at: "asc" } }),
  find: (id) => prisma.class_sessions.findUnique({ where: { id } }),
  findRoom: (id) => prisma.rooms.findUnique({ where: { id } }),
  findCoach: (id) => prisma.users.findFirst({ where: { id, role: "coach", status: "active" }, select: { id: true } }),
  hasScheduleConflict: (roomId, coachUserId, startsAt, endsAt, excludeId) => prisma.class_sessions.findFirst({
    where: { ...(excludeId && { id: { not: excludeId } }), status: { not: "cancelled" }, starts_at: { lt: endsAt }, ends_at: { gt: startsAt }, OR: [{ room_id: roomId }, { coach_user_id: coachUserId }] },
    select: { id: true, room_id: true, coach_user_id: true },
  }),
  rooms: () => prisma.rooms.findMany({ where: { is_active: true }, orderBy: { name: "asc" } }),
  coaches: () => prisma.users.findMany({ where: { role: "coach", status: "active" }, select: { id: true, display_name: true, email: true } }),
  coach: (coachUserId) => prisma.users.findMany({ where: { id: coachUserId, role: "coach", status: "active" }, select: { id: true, display_name: true, email: true } }),
  async coachesForMemberUser(userId) {
    const member = await prisma.members.findUnique({ where: { user_id: userId }, select: { id: true } });
    if (!member) return [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const assignments = await prisma.member_coach_assignments.findMany({ where: { member_id: member.id, effective_from: { lte: today }, OR: [{ effective_to: null }, { effective_to: { gte: today } }] }, select: { coach_user_id: true } });
    return prisma.users.findMany({ where: { id: { in: assignments.map((item) => item.coach_user_id) }, role: "coach", status: "active" }, select: { id: true, display_name: true, email: true } });
  },
  create: (data) => prisma.class_sessions.create({ data }),
  update: (id, data) => prisma.class_sessions.update({ where: { id }, data }),
  createChange: (data) => prisma.class_change_requests.create({ data }),
  changes: (status) => prisma.class_change_requests.findMany({ where: status ? { status } : undefined, orderBy: { created_at: "desc" } }),
  change: (id) => prisma.class_change_requests.findUnique({ where: { id } }),
  reviewChange: (id, status, reviewer) => prisma.class_change_requests.update({ where: { id }, data: { status, reviewed_by: reviewer, reviewed_at: new Date() } }),
  cancelBookings: (classId) => prisma.bookings.updateMany({ where: { class_session_id: classId, status: { in: ["confirmed", "waitlisted"] } }, data: { status: "cancelled", cancelled_at: new Date(), cancel_reason: "Lớp học đã được thay đổi lịch hoặc hủy." } }),
  notifyUser: (userId, title, body, linkPath) => prisma.notifications.create({ data: { recipient_user_id: userId, category: "operations", title, body, link_path: linkPath } }),
  async notifyClassMembers(classId, title, body) {
    const bookings = await prisma.bookings.findMany({ where: { class_session_id: classId }, select: { member_id: true } });
    const members = await prisma.members.findMany({ where: { id: { in: bookings.map((item) => item.member_id) } }, select: { user_id: true } });
    const notifications = members.filter((item) => item.user_id).map((item) => ({ recipient_user_id: item.user_id, category: "operations", title, body, link_path: `/classes/${classId}` }));
    if (notifications.length) await prisma.notifications.createMany({ data: notifications });
  },
};
