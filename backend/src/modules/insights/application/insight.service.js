import { AppError } from "../../../shared/errors/app-error.js";
import { reportingDay as isoDay, reportingRange as range } from "../domain/reporting-day.js";
import { serviceRevenue } from "../domain/service-revenue.js";

function previousRange(from, to) { const duration = to.getTime() - from.getTime() + 1; const previousTo = new Date(from.getTime() - 1); return { from: new Date(previousTo.getTime() - duration + 1), to: previousTo }; }
function change(current, previous) { return previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10; }
function attendanceRate(metrics) { return metrics.attendance.marked ? Math.round(((metrics.attendance.present + metrics.attendance.late) / metrics.attendance.marked) * 1000) / 10 : null; }
function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function asCsv(rows) { return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`; }
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
  const [metrics, previousMetrics, payments, pendingPayments, expiringMemberships, refunds] = await Promise.all([repository.managerMetrics(current.from, current.to), repository.managerMetrics(previous.from, previous.to), repository.revenuePayments(current.from, current.to), repository.pendingPayments(), repository.expiring(new Date(), new Date(Date.now() + 7 * 86400000)), repository.revenueRefunds(current.from, current.to)]);
  const currentAttendanceRate = attendanceRate(metrics);
  const previousAttendanceRate = attendanceRate(previousMetrics);
  return {
    period: current.period, from: current.from, to: current.to,
    metrics: { ...metrics, occupancyRate: metrics.capacity ? Math.round((metrics.bookings / metrics.capacity) * 1000) / 10 : null, attendanceRate: currentAttendanceRate },
    comparison: { revenueChange: change(Number(metrics.revenueVnd), Number(previousMetrics.revenueVnd)), newMembersChange: change(metrics.newMembers, previousMetrics.newMembers), bookingsChange: change(metrics.bookings, previousMetrics.bookings), attendanceChange: currentAttendanceRate === null || previousAttendanceRate === null ? null : change(currentAttendanceRate, previousAttendanceRate) },
    alerts: { pendingPayments, expiringMemberships: expiringMemberships.length }, revenueTrend: revenueTrend([...payments, ...refunds.map((refund) => ({ paid_at: refund.executed_at, amount_vnd: -refund.amount_vnd }))], current.from, current.to),
  };
}

export function createInsightService({ repository }) {
  return {
    notifications: (userId) => repository.notifications(userId), markRead: (id, userId) => repository.markRead(id, userId),
    async revenue(query) {
      const { from, to, period } = range(query);
      const [rows, paymentStatuses, paidPayments, refunds] = await Promise.all([repository.revenue(from, to), repository.paymentStatuses(from, to), repository.revenuePayments(from, to), repository.revenueRefunds(from, to)]);
      const receipts = rows.filter((row) => ["paid", "refunded"].includes(row.status));
      const gross = receipts.reduce((sum, row) => sum + (row._sum.amount_vnd ?? 0n), 0n);
      const refunded = refunds.reduce((sum, row) => sum + row.amount_vnd, 0n);
      return {
        period, from, to,
        paid: (gross - refunded).toString(), gross: gross.toString(), refunded: refunded.toString(),
        payments: receipts.reduce((sum, row) => sum + row._count.id, 0),
        createdSummary: statusTotals(paymentStatuses),
        paymentStatuses: paymentStatuses.map((row) => ({ status: row.status, count: row._count.id, amount: row._sum.amount_vnd?.toString() ?? "0" })),
        trend: revenueTrend([...paidPayments, ...refunds.map((refund) => ({ paid_at: refund.executed_at, amount_vnd: -refund.amount_vnd }))], from, to),
        byService: serviceRevenue(paidPayments, refunds),
      };
    },
    async attendance(query) {
      const { from, to, period } = range(query);
      const [byStatus, rows] = await Promise.all([repository.attendance(from, to, query.coachUserId), repository.attendanceRecords(from, to, query.coachUserId)]);
      return { period, from, to, coachUserId: query.coachUserId ?? null, byStatus, summary: attendanceTotals(byStatus), trend: attendanceTrend(rows, from, to) };
    },
    async exportReport(type, query) {
      if (type === "revenue") {
        const report = await this.revenue(query);
        return {
          filename: `bao-cao-doanh-thu-${isoDay(report.from)}-${isoDay(report.to)}.csv`,
          content: asCsv([
            ["Báo cáo doanh thu"], ["Kỳ", report.period], ["Từ", isoDay(report.from)], ["Đến", isoDay(report.to)],
            [], ["Chỉ số", "Giá trị"], ["Tổng đã thu", report.gross], ["Đã hoàn trong kỳ", report.refunded], ["Thực thu", report.paid], ["Số phiếu đã thanh toán", report.payments], ["Chờ xác nhận", report.createdSummary.pending], ["Số phiếu chờ xác nhận", report.createdSummary.pendingPayments], ["Giá trị giao dịch", report.createdSummary.transactionValue], ["Tỷ lệ hoàn tất (%)", report.createdSummary.completionRate ?? ""],
            [], ["Trạng thái", "Số giao dịch", "Tổng giá trị"], ...report.paymentStatuses.map((item) => [item.status, item.count, item.amount]),
            [], ["Dịch vụ", "Số giao dịch", "Thực thu", "Cần đối soát cấp quyền"], ...report.byService.map((item) => [item.name, item.payments, item.amountVnd, item.requiresReview]),
          ]),
        };
      }
      const report = await this.attendance(query);
      return {
        filename: `bao-cao-diem-danh-${isoDay(report.from)}-${isoDay(report.to)}.csv`,
        content: asCsv([
          ["Báo cáo điểm danh"], ["Kỳ", report.period], ["Từ", isoDay(report.from)], ["Đến", isoDay(report.to)], ["Coach", report.coachUserId ?? "Tất cả"],
          [], ["Chỉ số", "Giá trị"], ["Tổng lượt", report.summary.total], ["Đã tham gia", report.summary.attended], ["Vắng mặt", report.summary.absent], ["Chưa ghi nhận", report.summary.notMarked], ["Tỷ lệ tham gia (%)", report.summary.attendanceRate ?? ""],
          [], ["Trạng thái", "Số lượt"], ...report.byStatus.map((item) => [item.status, item._count.id]),
        ]),
      };
    },
    async dashboard(role, actor, query = {}) {
      if (role !== actor.role) throw new AppError({ statusCode: 403, code: "DASHBOARD_ROLE_FORBIDDEN", message: "Bạn chỉ có thể xem dashboard của vai trò hiện tại." });
      const current = range(query); const sevenDays = new Date(Date.now() + 7 * 86400000);
      if (["admin", "manager"].includes(actor.role)) return { role, ...(await managerDashboard(repository, current, previousRange(current.from, current.to))) };
      if (actor.role === "coach") return { role, todayClasses: await repository.coachTodayClasses(actor.id, current.from, current.to), assignedClasses: await repository.coachClasses(actor.id), trainingPlans: await repository.coachTrainingPlans(actor.id), pendingPayments: 0, expiringMemberships: 0 };
      if (actor.role === "member") { const member = await repository.memberByUser(actor.id); if (!member) throw new AppError({ statusCode: 404, code: "MEMBER_PROFILE_NOT_FOUND", message: "Tài khoản chưa có hồ sơ hội viên." }); return { role, todayClasses: await repository.memberTodayClasses(member.id, current.from, current.to), pendingPayments: await repository.memberPendingPayments(member.id), expiringMemberships: await repository.memberExpiringMemberships(member.id, current.from, sevenDays) }; }
      return { role, todayClasses: await repository.todayClasses(current.from, current.to), pendingPayments: await repository.pendingCashPayments(), expiringMemberships: (await repository.expiring(current.from, sevenDays)).length };
    },
  };
}
