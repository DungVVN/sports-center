import { prisma } from "../../../database.js";
import { trainingRepository } from "../../training/index.js";

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
  pendingCashPayments: () => prisma.payments.count({ where: { status: "pending", method: "cash" } }),
  coachClasses: (coachUserId) => prisma.class_sessions.count({ where: { coach_user_id: coachUserId, pt_purchase_id: null } }),
  coachTrainingPlans: (coachUserId) => trainingRepository.planCountForCoach(coachUserId),
  coachTodayClasses: (coachUserId, from, to) => prisma.class_sessions.count({ where: { coach_user_id: coachUserId, starts_at: { gte: from, lte: to }, status: "published" } }),
  memberByUser: (userId) => prisma.members.findUnique({ where: { user_id: userId }, select: { id: true } }),
  memberTodayClasses: async (memberId, from, to) => {
    const bookings = await prisma.bookings.findMany({ where: { member_id: memberId, status: "confirmed" }, select: { class_session_id: true } });
    return prisma.class_sessions.count({ where: { id: { in: bookings.map((item) => item.class_session_id) }, starts_at: { gte: from, lte: to }, status: "published" } });
  },
  memberPendingPayments: (memberId) => prisma.payments.count({ where: { member_id: memberId, status: "pending" } }),
  memberExpiringMemberships: (memberId, from, to) => prisma.member_memberships.count({ where: { member_id: memberId, status: { in: ["active", "expiring_soon"] }, expires_on: { gte: from, lte: to } } }),
  async managerMetrics(from, to) {
    const classes = await prisma.class_sessions.findMany({ where: { status: "published", starts_at: { gte: from, lte: to } }, select: { id: true, capacity: true } });
    const classIds = classes.map((item) => item.id);
    const [revenueRows, members, bookings, attendanceRows, refunds] = await Promise.all([
      prisma.payments.groupBy({ by: ["status"], where: { paid_at: { gte: from, lte: to } }, _sum: { amount_vnd: true }, _count: { id: true } }),
      prisma.members.count({ where: { joined_at: { gte: from, lte: to } } }),
      classIds.length ? prisma.bookings.count({ where: { class_session_id: { in: classIds }, status: { in: activeBookingStatuses } } }) : 0,
      prisma.attendance_records.groupBy({ by: ["status"], where: { recorded_at: { gte: from, lte: to } }, _count: { id: true } }),
      prisma.service_refunds.aggregate({ where: { status: "completed", executed_at: { gte: from, lte: to } }, _sum: { amount_vnd: true } }),
    ]);
    const receipts = revenueRows.filter((item) => ["paid", "refunded"].includes(item.status));
    const gross = receipts.reduce((sum, item) => sum + (item._sum.amount_vnd ?? 0n), 0n);
    const attendance = Object.fromEntries(attendanceRows.map((item) => [item.status, item._count.id]));
    const marked = (attendance.present ?? 0) + (attendance.late ?? 0) + (attendance.absent ?? 0);
    return {
      revenueVnd: (gross - (refunds._sum.amount_vnd ?? 0n)).toString(), paidPayments: receipts.reduce((sum, item) => sum + item._count.id, 0), newMembers: members,
      classes: classes.length, bookings, capacity: classes.reduce((total, item) => total + item.capacity, 0),
      attendance: { present: attendance.present ?? 0, late: attendance.late ?? 0, absent: attendance.absent ?? 0, marked },
    };
  },
  async revenueRefunds(from, to) {
    const refunds = await prisma.service_refunds.findMany({ where: { status: "completed", executed_at: { gte: from, lte: to } }, orderBy: { executed_at: "asc" } });
    const payments = await prisma.payments.findMany({ where: { id: { in: refunds.map((refund) => refund.payment_id) } } });
    return refunds.map((refund) => ({ ...refund, payments: payments.find((payment) => payment.id === refund.payment_id) }));
  },
  revenuePayments: (from, to) => prisma.payments.findMany({ where: { status: { in: ["paid", "refunded"] }, paid_at: { gte: from, lte: to } }, select: { paid_at: true, amount_vnd: true, membership_id: true, course_enrollment_id: true, pt_purchase_id: true, facility_reservation_id: true, fulfillment_error: true }, orderBy: { paid_at: "asc" } }),
};
