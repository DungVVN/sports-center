import { prisma } from "../../database.js";

export const bookingRepository = {
  list: async ({ memberId, coachUserId } = {}) => {
    const classIds = coachUserId
      ? (await prisma.class_sessions.findMany({ where: { coach_user_id: coachUserId }, select: { id: true } })).map((item) => item.id)
      : null;
    const bookings = await prisma.bookings.findMany({
      where: { ...(memberId ? { member_id: memberId } : {}), ...(classIds ? { class_session_id: { in: classIds } } : {}) },
      orderBy: { booked_at: "desc" },
    });
    const sessions = await prisma.class_sessions.findMany({
      where: { id: { in: bookings.map((booking) => booking.class_session_id) } },
      select: { id: true, name: true, coach_user_id: true, starts_at: true, ends_at: true },
    });
    const coaches = await prisma.users.findMany({
      where: { id: { in: sessions.map((session) => session.coach_user_id) } },
      select: { id: true, display_name: true },
    });
    const members = await prisma.members.findMany({
      where: { id: { in: bookings.map((booking) => booking.member_id) } },
      select: { id: true, full_name: true, member_code: true },
    });
    const sessionById = new Map(sessions.map((session) => [session.id, session]));
    const coachById = new Map(coaches.map((coach) => [coach.id, coach]));
    const memberById = new Map(members.map((member) => [member.id, member]));
    return bookings.map((booking) => ({
      ...booking,
      class_session: (() => {
        const session = sessionById.get(booking.class_session_id);
        return session
          ? {
              ...session,
              coach: coachById.get(session.coach_user_id) ?? null,
            }
          : null;
      })(),
      member: memberById.get(booking.member_id) ?? null,
    }));
  },
  listForClass: async (classId, memberId) => {
    const bookings = await prisma.bookings.findMany({ where: { class_session_id: classId, ...(memberId ? { member_id: memberId } : {}) }, orderBy: { booked_at: "desc" } });
    const members = await prisma.members.findMany({ where: { id: { in: bookings.map((booking) => booking.member_id) } }, select: { id: true, full_name: true, member_code: true } });
    const memberById = new Map(members.map((member) => [member.id, member]));
    return bookings.map((booking) => ({ ...booking, member: memberById.get(booking.member_id) ?? null }));
  },
  find: (id) => prisma.bookings.findUnique({ where: { id } }),
  class: (id) => prisma.class_sessions.findUnique({ where: { id } }),
  member: (id) => prisma.members.findUnique({ where: { id } }),
  memberByUser: (userId) => prisma.members.findUnique({ where: { user_id: userId } }),
  activeMembership: (memberId, accessAt) => prisma.member_memberships.findFirst({ where: { member_id: memberId, status: { in: ["active", "expiring_soon"] }, starts_on: { lte: accessAt }, OR: [{ expires_on: { gte: accessAt } }, { grace_expires_at: { gte: accessAt } }] }, orderBy: { expires_on: "desc" } }),
  entitlement: (packageId) => prisma.membership_package_entitlements.findUnique({ where: { package_id_entitlement: { package_id: packageId, entitlement: "group_class_booking" } } }),
  createWithCapacity: ({ bookingCode, memberId, classId, bookedBy }) => prisma.$transaction(async (tx) => {
    const existing = await tx.bookings.findFirst({ where: { member_id: memberId, class_session_id: classId, status: { in: ["confirmed", "waitlisted"] } } });
    if (existing) return { duplicate: true, booking: existing };
    const session = await tx.class_sessions.findUnique({ where: { id: classId } });
    const confirmed = await tx.bookings.count({ where: { class_session_id: classId, status: "confirmed" } });
    const status = confirmed >= session.capacity ? "waitlisted" : "confirmed";
    const booking = await tx.bookings.create({ data: { booking_code: bookingCode, member_id: memberId, class_session_id: classId, status, booked_by: bookedBy } });
    return { duplicate: false, booking };
  }, { isolationLevel: "Serializable" }),
  cancel: (id, reason) => prisma.bookings.update({ where: { id }, data: { status: "cancelled", cancelled_at: new Date(), cancel_reason: reason } }),
  promoteWaitlisted: async (classId) => prisma.$transaction(async (tx) => {
    const next = await tx.bookings.findFirst({ where: { class_session_id: classId, status: "waitlisted" }, orderBy: { booked_at: "asc" } });
    if (!next) return null;
    const booking = await tx.bookings.update({ where: { id: next.id }, data: { status: "confirmed" } });
    const member = await tx.members.findUnique({ where: { id: next.member_id } });
    if (member?.user_id) await tx.notifications.create({ data: { recipient_user_id: member.user_id, category: "member", title: "Đã có chỗ trong lớp", body: "Bạn đã được xác nhận từ danh sách chờ.", link_path: `/bookings/${booking.id}` } });
    return booking;
  }),
};
