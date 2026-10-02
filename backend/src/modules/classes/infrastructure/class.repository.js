import { prisma } from "../../../database.js";
import { AppError } from "../../../shared/errors/app-error.js";

export const classRepository = {
  list: () => prisma.class_sessions.findMany({ where: { pt_purchase_id: null }, orderBy: { starts_at: "asc" } }),
  listForCoach: (coachUserId) => prisma.class_sessions.findMany({ where: { coach_user_id: coachUserId, pt_purchase_id: null }, orderBy: { starts_at: "asc" } }),
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
  update: (id, data) => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM class_sessions WHERE id = ${id}::uuid FOR UPDATE`;
    if (data.capacity !== undefined) {
      const occupied = await tx.bookings.count({ where: { class_session_id: id, status: { in: ["confirmed", "attended"] } } });
      if (data.capacity < occupied) throw new AppError({ statusCode: 422, code: "CLASS_CAPACITY_BELOW_BOOKINGS", message: "Sĩ số lớp không được thấp hơn số chỗ đã xác nhận hoặc đã tham gia." });
    }
    return tx.class_sessions.update({ where: { id }, data });
  }),
  createChange: (data) => prisma.class_change_requests.create({ data }),
  changes: (status) => prisma.class_change_requests.findMany({ where: status ? { status } : undefined, orderBy: { created_at: "desc" } }),
  change: (id) => prisma.class_change_requests.findUnique({ where: { id } }),
  async reviewChange(id, status, reviewer, { notification, audit }) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM class_change_requests WHERE id = ${id}::uuid FOR UPDATE`;
      const change = await tx.class_change_requests.findUnique({ where: { id } });
      if (!change || change.status !== "pending") {
        throw new AppError({ statusCode: 422, code: "CLASS_CHANGE_UNAVAILABLE", message: "Yêu cầu thay đổi không còn chờ duyệt." });
      }
      if (status === "approved") {
        await tx.$queryRaw`SELECT id FROM class_sessions WHERE id = ${change.class_session_id}::uuid FOR UPDATE`;
        const session = await tx.class_sessions.findUnique({ where: { id: change.class_session_id } });
        if (!session || session.status !== "published") {
          throw new AppError({ statusCode: 422, code: "CLASS_CHANGE_UNAVAILABLE", message: "Lớp học không còn đủ điều kiện để thay đổi." });
        }
        await tx.class_sessions.update({ where: { id: session.id }, data: change.type === "cancel"
          ? { status: "cancelled" }
          : { starts_at: change.proposed_starts_at, ends_at: change.proposed_ends_at } });
        const memberIds = await cancelBookings(tx, session.id);
        await notifyClassMembers(tx, memberIds, notification);
      } else {
        await tx.notifications.create({ data: { recipient_user_id: change.requested_by, category: "operations", ...notification, link_path: "/classes" } });
      }
      const result = await tx.class_change_requests.update({ where: { id }, data: { status, reviewed_by: reviewer, reviewed_at: new Date() } });
      await tx.audit_logs.create({ data: { actor_user_id: reviewer, entity_type: "class_session", entity_id: change.class_session_id, ...audit } });
      return result;
    });
  },
};

async function cancelBookings(client, classId) {
  const cancelled = await client.bookings.updateManyAndReturn({
    where: { class_session_id: classId, status: { in: ["confirmed", "waitlisted"] } },
    data: { status: "cancelled", cancelled_at: new Date(), cancel_reason: "Lớp học đã được thay đổi lịch hoặc hủy." },
    select: { member_id: true },
  });
  return [...new Set(cancelled.map((booking) => booking.member_id))];
}

async function notifyClassMembers(client, memberIds, { title, body }) {
  if (!memberIds.length) return;
  const members = await client.members.findMany({ where: { id: { in: memberIds } }, select: { user_id: true } });
  const notifications = [...new Set(members.map((item) => item.user_id).filter(Boolean))].map((userId) => ({ recipient_user_id: userId, category: "operations", title, body, link_path: "/bookings" }));
  if (notifications.length) await client.notifications.createMany({ data: notifications });
}
