import { prisma } from "../../../database.js";

async function serializable(operation) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error?.code !== "P2034" || attempt === 2) throw error;
    }
  }
}

async function bookingEntitlement(database, packageId) {
  const membershipPackage = await database.membership_packages.findUnique({ where: { id: packageId }, select: { tier_rank: true } });
  if (!membershipPackage) return null;
  const eligiblePackages = await database.membership_packages.findMany({ where: { tier_rank: { lte: membershipPackage.tier_rank } }, select: { id: true, tier_rank: true } });
  const tiersByPackageId = new Map(eligiblePackages.map((item) => [item.id, item.tier_rank]));
  const entitlements = await database.membership_package_entitlements.findMany({ where: { package_id: { in: eligiblePackages.map((item) => item.id) }, entitlement: "group_class_booking" } });
  return entitlements.sort((left, right) => (tiersByPackageId.get(right.package_id) ?? 0) - (tiersByPackageId.get(left.package_id) ?? 0))[0] ?? null;
}

async function eligibleMembership(database, memberId, accessAt) {
  const memberships = await database.member_memberships.findMany({
    where: { member_id: memberId, status: { in: ["active", "expiring_soon"] }, starts_on: { lte: accessAt }, OR: [{ expires_on: { gte: accessAt } }, { grace_expires_at: { gte: accessAt } }] },
    orderBy: { expires_on: "desc" },
  });
  if (memberships.length === 0) return null;
  const accessDay = new Date(Date.UTC(accessAt.getUTCFullYear(), accessAt.getUTCMonth(), accessAt.getUTCDate()));
  const frozen = await database.membership_freeze_requests.findMany({
    where: { membership_id: { in: memberships.map((membership) => membership.id) }, status: "approved", starts_on: { lte: accessDay }, ends_on: { gt: accessDay } },
    select: { membership_id: true },
  });
  const frozenIds = new Set(frozen.map((request) => request.membership_id));
  return memberships.find((membership) => !frozenIds.has(membership.id)) ?? null;
}

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
  activeMembership: (memberId, accessAt) => eligibleMembership(prisma, memberId, accessAt),
  entitlement: (packageId) => bookingEntitlement(prisma, packageId),
  createWithCapacity: ({ bookingCode, memberId, classId, bookedBy }) => serializable(async (tx) => {
    const existing = await tx.bookings.findFirst({ where: { member_id: memberId, class_session_id: classId, status: { in: ["confirmed", "waitlisted"] } } });
    if (existing) return { duplicate: true, booking: existing };
    const session = await tx.class_sessions.findUnique({ where: { id: classId } });
    const confirmed = await tx.bookings.count({ where: { class_session_id: classId, status: "confirmed" } });
    const status = confirmed >= session.capacity ? "waitlisted" : "confirmed";
    const booking = await tx.bookings.create({ data: { booking_code: bookingCode, member_id: memberId, class_session_id: classId, status, booked_by: bookedBy } });
    if (status === "waitlisted") {
      const member = await tx.members.findUnique({ where: { id: memberId }, select: { user_id: true } });
      if (member?.user_id) await tx.notifications.create({ data: { recipient_user_id: member.user_id, category: "member", title: "Bạn đang trong danh sách chờ", body: "Lớp hiện đã đủ chỗ. Hệ thống sẽ tự động xác nhận khi có chỗ trống và bạn còn đủ điều kiện tham gia.", link_path: `/bookings/${booking.id}` } });
    }
    return { duplicate: false, booking };
  }),
  cancel: (id, reason) => prisma.bookings.update({ where: { id }, data: { status: "cancelled", cancelled_at: new Date(), cancel_reason: reason } }),
  promoteWaitlisted: async (classId) => serializable(async (tx) => {
    const session = await tx.class_sessions.findUnique({ where: { id: classId }, select: { starts_at: true } });
    if (!session) return null;
    const waitlisted = await tx.bookings.findMany({ where: { class_session_id: classId, status: "waitlisted" }, orderBy: { booked_at: "asc" } });
    for (const candidate of waitlisted) {
      const membership = await eligibleMembership(tx, candidate.member_id, session.starts_at);
      if (!membership || !await bookingEntitlement(tx, membership.package_id)) continue;
      const booking = await tx.bookings.update({ where: { id: candidate.id }, data: { status: "confirmed" } });
      const member = await tx.members.findUnique({ where: { id: candidate.member_id }, select: { user_id: true } });
      if (member?.user_id) await tx.notifications.create({ data: { recipient_user_id: member.user_id, category: "member", title: "Đã có chỗ trong lớp", body: "Bạn đã được xác nhận từ danh sách chờ vì có chỗ trống.", link_path: `/bookings/${booking.id}` } });
      return booking;
    }
    return null;
  }),
};
