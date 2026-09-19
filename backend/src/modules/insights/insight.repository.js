import { prisma } from "../../database.js";

const activeBookingStatuses = ["confirmed", "attended", "absent"];

export const insightRepository = {
  notifications: (userId) => prisma.notifications.findMany({ where: { recipient_user_id: userId }, orderBy: { created_at: "desc" }, take: 50 }),
  markRead: (id, userId) => prisma.notifications.updateMany({ where: { id, recipient_user_id: userId }, data: { read_at: new Date() } }),
  revenue: (from, to) => prisma.payments.groupBy({ by: ["status"], where: { paid_at: { gte: from, lte: to } }, _sum: { amount_vnd: true }, _count: { id: true } }),
  paymentStatuses: (from, to) => prisma.payments.groupBy({ by: ["status"], where: { created_at: { gte: from, lte: to } }, _sum: { amount_vnd: true }, _count: { id: true } }),
  async attendance(from, to, coachUserId) { const classIds = coachUserId ? (await prisma.class_sessions.findMany({ where: { coach_user_id: coachUserId }, select: { id: true } })).map((item) => item.id) : null; return prisma.attendance_records.groupBy({ by: ["status"], where: { recorded_at: { gte: from, lte: to }, ...(classIds ? { class_session_id: { in: classIds } } : {}) }, _count: { id: true } }); },
  async attendanceRecords(from, to, coachUserId) { const classIds = coachUserId ? (await prisma.class_sessions.findMany({ where: { coach_user_id: coachUserId }, select: { id: true } })).map((item) => item.id) : null; return prisma.attendance_records.findMany({ where: { recorded_at: { gte: from, lte: to }, ...(classIds ? { class_session_id: { in: classIds } } : {}) }, select: { recorded_at: true, status: true }, orderBy: { recorded_at: "asc" } }); },
  expiring: (from, to) => prisma.member_memberships.findMany({ where: { status: "active", expires_on: { gte: from, lte: to } } }),
  todayClasses: (from, to) => prisma.class_sessions.count({ where: { starts_at: { gte: from, lte: to }, status: "published" } }),
  pendingPayments: () => prisma.payments.count({ where: { status: "pending" } }),
  coachTodayClasses: (coachUserId, from, to) => prisma.class_sessions.count({ where: { coach_user_id: coachUserId, starts_at: { gte: from, lte: to }, status: "published" } }),
  memberByUser: (userId) => prisma.members.findUnique({ where: { user_id: userId }, select: { id: true } }),
  memberTodayClasses: async (memberId, from, to) => {
    const bookings = await prisma.bookings.findMany({ where: { member_id: memberId, status: "confirmed" }, select: { class_session_id: true } });
    return prisma.class_sessions.count({ where: { id: { in: bookings.map((item) => item.class_session_id) }, starts_at: { gte: from, lte: to }, status: "published" } });
  },
  memberPendingMemberships: (memberId) => prisma.member_memberships.count({ where: { member_id: memberId, status: "pending_payment" } }),
  memberExpiringMemberships: (memberId, from, to) => prisma.member_memberships.count({ where: { member_id: memberId, status: { in: ["active", "expiring_soon"] }, expires_on: { gte: from, lte: to } } }),
  async managerMetrics(from, to) {
    const classes = await prisma.class_sessions.findMany({ where: { status: "published", starts_at: { gte: from, lte: to } }, select: { id: true, capacity: true } });
    const classIds = classes.map((item) => item.id);
    const [revenueRows, members, bookings, attendanceRows] = await Promise.all([
      prisma.payments.groupBy({ by: ["status"], where: { paid_at: { gte: from, lte: to } }, _sum: { amount_vnd: true }, _count: { id: true } }),
      prisma.members.count({ where: { joined_at: { gte: from, lte: to } } }),
      classIds.length ? prisma.bookings.count({ where: { class_session_id: { in: classIds }, status: { in: activeBookingStatuses } } }) : 0,
      prisma.attendance_records.groupBy({ by: ["status"], where: { recorded_at: { gte: from, lte: to } }, _count: { id: true } }),
    ]);
    const paid = revenueRows.find((item) => item.status === "paid");
    const attendance = Object.fromEntries(attendanceRows.map((item) => [item.status, item._count.id]));
    const marked = (attendance.present ?? 0) + (attendance.late ?? 0) + (attendance.absent ?? 0);
    return {
      revenueVnd: (paid?._sum.amount_vnd ?? BigInt(0)).toString(), paidPayments: paid?._count.id ?? 0, newMembers: members,
      classes: classes.length, bookings, capacity: classes.reduce((total, item) => total + item.capacity, 0),
      attendance: { present: attendance.present ?? 0, late: attendance.late ?? 0, absent: attendance.absent ?? 0, marked },
    };
  },
  revenuePayments: (from, to) => prisma.payments.findMany({ where: { status: "paid", paid_at: { gte: from, lte: to } }, select: { paid_at: true, amount_vnd: true }, orderBy: { paid_at: "asc" } }),
};
