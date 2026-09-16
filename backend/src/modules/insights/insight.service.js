import { AppError } from "../../shared/errors/app-error.js";

function range(query = {}) {
  const now = new Date(); const from = new Date(now); const to = new Date(now); const period = query.period ?? "day";
  if (period === "custom") { from.setTime(new Date(`${query.from}T00:00:00.000Z`).getTime()); to.setTime(new Date(`${query.to}T23:59:59.999Z`).getTime()); }
  else { from.setHours(0, 0, 0, 0); to.setHours(23, 59, 59, 999); if (period === "week") from.setDate(from.getDate() - ((from.getDay() + 6) % 7)); if (period === "month") from.setDate(1); if (period === "quarter") from.setMonth(Math.floor(from.getMonth() / 3) * 3, 1); if (period === "year") from.setMonth(0, 1); }
  return { from, to, period };
}
function previousRange(from, to) { const duration = to.getTime() - from.getTime() + 1; const previousTo = new Date(from.getTime() - 1); return { from: new Date(previousTo.getTime() - duration + 1), to: previousTo }; }
function change(current, previous) { return previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10; }
function isoDay(value) { return value.toISOString().slice(0, 10); }
function revenueTrend(rows, from, to) { const totals = new Map(); for (let cursor = new Date(from); cursor <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) totals.set(isoDay(cursor), BigInt(0)); for (const row of rows) { const key = isoDay(row.paid_at); totals.set(key, (totals.get(key) ?? BigInt(0)) + row.amount_vnd); } return [...totals].map(([date, amountVnd]) => ({ date, amountVnd: amountVnd.toString() })); }
function statusTotals(rows) {
  const byStatus = new Map(rows.map((row) => [row.status, { count: row._count.id, amount: row._sum.amount_vnd ?? BigInt(0) }]));
  const paid = byStatus.get("paid") ?? { count: 0, amount: BigInt(0) };
  const pending = byStatus.get("pending") ?? { count: 0, amount: BigInt(0) };
  const total = paid.amount + pending.amount;
  return {
    transactionValue: total.toString(),
    pending: pending.amount.toString(),
    pendingPayments: pending.count,
    completionRate: total === BigInt(0) ? null : Math.round((Number(paid.amount) / Number(total)) * 1000) / 10,
  };
}
function attendanceTotals(rows) {
  const byStatus = new Map(rows.map((row) => [row.status, row._count.id]));
  const present = byStatus.get("present") ?? 0;
  const late = byStatus.get("late") ?? 0;
  const absent = byStatus.get("absent") ?? 0;
  const notMarked = byStatus.get("not_marked") ?? 0;
  const marked = present + late + absent;
  return {
    total: marked + notMarked,
    attended: present + late,
    absent,
    notMarked,
    attendanceRate: marked === 0 ? null : Math.round(((present + late) / marked) * 1000) / 10,
  };
}
function attendanceTrend(rows, from, to) {
  const totals = new Map();
  for (let cursor = new Date(from); cursor <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) totals.set(isoDay(cursor), { present: 0, late: 0, absent: 0, notMarked: 0 });
  for (const row of rows) {
    const day = totals.get(isoDay(row.recorded_at));
    if (!day) continue;
    if (row.status === "present") day.present += 1;
    else if (row.status === "late") day.late += 1;
    else if (row.status === "absent") day.absent += 1;
    else day.notMarked += 1;
  }
  return [...totals].map(([date, value]) => ({ date, ...value }));
}

async function managerDashboard(repository, current, previous) {
  const [metrics, previousMetrics, payments, pendingPayments, expiringMemberships] = await Promise.all([repository.managerMetrics(current.from, current.to), repository.managerMetrics(previous.from, previous.to), repository.revenuePayments(current.from, current.to), repository.pendingPayments(), repository.expiring(new Date(), new Date(Date.now() + 7 * 86400000))]);
  return {
    period: current.period, from: current.from, to: current.to,
    metrics: { ...metrics, occupancyRate: metrics.capacity ? Math.round((metrics.bookings / metrics.capacity) * 1000) / 10 : null, attendanceRate: metrics.attendance.marked ? Math.round(((metrics.attendance.present + metrics.attendance.late) / metrics.attendance.marked) * 1000) / 10 : null },
    comparison: { revenueChange: change(Number(metrics.revenueVnd), Number(previousMetrics.revenueVnd)), newMembersChange: change(metrics.newMembers, previousMetrics.newMembers), bookingsChange: change(metrics.bookings, previousMetrics.bookings), attendanceChange: change(metrics.attendance.present + metrics.attendance.late, previousMetrics.attendance.present + previousMetrics.attendance.late) },
    alerts: { pendingPayments, expiringMemberships: expiringMemberships.length }, revenueTrend: revenueTrend(payments, current.from, current.to),
  };
}

export function createInsightService({ repository }) {
  return {
    notifications: (userId) => repository.notifications(userId), markRead: (id, userId) => repository.markRead(id, userId),
    async revenue(query) {
      const { from, to, period } = range(query);
      const [rows, paymentStatuses, paidPayments] = await Promise.all([repository.revenue(from, to), repository.paymentStatuses(from, to), repository.revenuePayments(from, to)]);
      const paid = rows.find((row) => row.status === "paid");
      return {
        period, from, to,
        paid: paid?._sum.amount_vnd?.toString() ?? "0",
        payments: paid?._count.id ?? 0,
        createdSummary: statusTotals(paymentStatuses),
        paymentStatuses: paymentStatuses.map((row) => ({ status: row.status, count: row._count.id, amount: row._sum.amount_vnd?.toString() ?? "0" })),
        trend: revenueTrend(paidPayments, from, to),
      };
    },
    async attendance(query) {
      const { from, to, period } = range(query);
      const [byStatus, rows] = await Promise.all([repository.attendance(from, to, query.coachUserId), repository.attendanceRecords(from, to, query.coachUserId)]);
      return { period, from, to, coachUserId: query.coachUserId ?? null, byStatus, summary: attendanceTotals(byStatus), trend: attendanceTrend(rows, from, to) };
    },
    async dashboard(role, actor, query = {}) {
      if (role !== actor.role) throw new AppError({ statusCode: 403, code: "DASHBOARD_ROLE_FORBIDDEN", message: "Bạn chỉ có thể xem dashboard của vai trò hiện tại." });
      const current = range(query); const sevenDays = new Date(Date.now() + 7 * 86400000);
      if (actor.role === "manager") return { role, ...(await managerDashboard(repository, current, previousRange(current.from, current.to))) };
      if (actor.role === "coach") return { role, todayClasses: await repository.coachTodayClasses(actor.id, current.from, current.to), pendingPayments: 0, expiringMemberships: 0 };
      if (actor.role === "member") { const member = await repository.memberByUser(actor.id); if (!member) throw new AppError({ statusCode: 404, code: "MEMBER_PROFILE_NOT_FOUND", message: "Tài khoản chưa có hồ sơ hội viên." }); return { role, todayClasses: await repository.memberTodayClasses(member.id, current.from, current.to), pendingPayments: await repository.memberPendingMemberships(member.id), expiringMemberships: await repository.memberExpiringMemberships(member.id, current.from, sevenDays) }; }
      return { role, todayClasses: await repository.todayClasses(current.from, current.to), pendingPayments: await repository.pendingPayments(), expiringMemberships: (await repository.expiring(current.from, sevenDays)).length };
    },
  };
}
