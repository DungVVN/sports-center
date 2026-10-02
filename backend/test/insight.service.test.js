import { afterEach, describe, expect, it, vi } from "vitest";
import { createInsightService } from "../src/modules/insights/index.js";

function repository() { return { revenueRefunds: vi.fn().mockResolvedValue([]), revenue: vi.fn().mockResolvedValue([{ status: "paid", _sum: { amount_vnd: BigInt(500000) }, _count: { id: 1 } }]), paymentStatuses: vi.fn().mockResolvedValue([{ status: "pending", _sum: { amount_vnd: BigInt(300000) }, _count: { id: 2 } }]), attendance: vi.fn().mockResolvedValue([{ status: "present", _count: { id: 3 } }]), attendanceRecords: vi.fn().mockResolvedValue([]), todayClasses: vi.fn().mockResolvedValue(4), pendingPayments: vi.fn().mockResolvedValue(3), expiring: vi.fn().mockResolvedValue([{}, {}]), coachTodayClasses: vi.fn().mockResolvedValue(2), memberByUser: vi.fn().mockResolvedValue({ id: "member-1" }), memberTodayClasses: vi.fn().mockResolvedValue(1), memberPendingMemberships: vi.fn().mockResolvedValue(1), memberExpiringMemberships: vi.fn().mockResolvedValue(1), managerMetrics: vi.fn().mockResolvedValue({ revenueVnd: "500000", newMembers: 2, classes: 3, bookings: 4, capacity: 10, attendance: { present: 3, late: 1, absent: 1, marked: 5 } }), revenuePayments: vi.fn().mockResolvedValue([]) }; }

describe("Insight dashboard service", () => {
  it("does not report an attendance decrease when the current period has no records", async () => {
    const repo = repository();
    const previous = await repo.managerMetrics();
    repo.managerMetrics.mockReset().mockResolvedValueOnce({ ...previous, attendance: { present: 0, late: 0, absent: 0, marked: 0 } }).mockResolvedValueOnce(previous);
    const result = await createInsightService({ repository: repo }).dashboard("manager", { id: "manager-1", role: "manager" }, { period: "month" });
    expect(result.metrics.attendanceRate).toBeNull();
    expect(result.comparison.attendanceChange).toBeNull();
  });

  it("compares attendance rates independently of the number of records", async () => {
    const repo = repository();
    const previous = await repo.managerMetrics();
    repo.managerMetrics.mockReset().mockResolvedValueOnce({ ...previous, attendance: { present: 6, late: 2, absent: 2, marked: 10 } }).mockResolvedValueOnce(previous);
    const result = await createInsightService({ repository: repo }).dashboard("manager", { id: "manager-1", role: "manager" }, { period: "month" });
    expect(result.metrics.attendanceRate).toBe(80);
    expect(result.comparison.attendanceChange).toBe(0);
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    ["day", "2026-12-31T17:00:00.000Z"],
    ["week", "2026-12-27T17:00:00.000Z"],
    ["month", "2026-12-31T17:00:00.000Z"],
    ["quarter", "2026-12-31T17:00:00.000Z"],
    ["year", "2026-12-31T17:00:00.000Z"],
  ])("uses Vietnam calendar boundaries for %s at the year rollover", async (period, from) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T18:00:00.000Z"));
    const report = await createInsightService({ repository: repository() }).revenue({ period });
    expect(report.from.toISOString()).toBe(from);
    expect(report.to.toISOString()).toBe("2027-01-01T16:59:59.999Z");
  });

  it("groups midnight transactions and CSV dates by Vietnam business day", async () => {
    const repo = repository();
    repo.revenuePayments.mockResolvedValue([
      { paid_at: new Date("2026-10-01T17:00:00.000Z"), amount_vnd: 100n },
      { paid_at: new Date("2026-10-02T16:59:59.999Z"), amount_vnd: 200n },
    ]);
    const service = createInsightService({ repository: repo });
    const query = { period: "custom", from: "2026-10-02", to: "2026-10-02" };
    const report = await service.revenue(query);
    expect(report.from.toISOString()).toBe("2026-10-01T17:00:00.000Z");
    expect(report.to.toISOString()).toBe("2026-10-02T16:59:59.999Z");
    expect(report.trend).toEqual([{ date: "2026-10-02", amountVnd: "300" }]);
    expect((await service.exportReport("revenue", query)).filename).toBe("bao-cao-doanh-thu-2026-10-02-2026-10-02.csv");
  });

  it("groups attendance near midnight into the same reporting day", async () => {
    const repo = repository();
    repo.attendanceRecords.mockResolvedValue([{ recorded_at: new Date("2026-10-01T17:01:00.000Z"), status: "present" }]);
    const report = await createInsightService({ repository: repo }).attendance({ period: "custom", from: "2026-10-02", to: "2026-10-02" });
    expect(report.trend).toEqual([{ date: "2026-10-02", present: 1, late: 0, absent: 0, notMarked: 0 }]);
  });
  it("rejects a request for a different role dashboard", async () => {
    const service = createInsightService({ repository: repository() });
    await expect(service.dashboard("manager", { id: "member-user", role: "member" })).rejects.toMatchObject({ code: "DASHBOARD_ROLE_FORBIDDEN" });
  });

  it("returns only member-scoped dashboard values", async () => {
    const repo = repository(); const service = createInsightService({ repository: repo });
    await expect(service.dashboard("member", { id: "member-user", role: "member" })).resolves.toMatchObject({ role: "member", todayClasses: 1, pendingPayments: 1, expiringMemberships: 1 });
    expect(repo.pendingPayments).not.toHaveBeenCalled();
    expect(repo.todayClasses).not.toHaveBeenCalled();
  });

  it("keeps revenue based on paid_at while returning operational payment states separately", async () => {
    const service = createInsightService({ repository: repository() });
    await expect(service.revenue({ period: "month" })).resolves.toMatchObject({ paid: "500000", payments: 1, paymentStatuses: [{ status: "pending", count: 2, amount: "300000" }] });
  });

  it("returns manager metrics with an equal-length previous-period comparison", async () => {
    const repo = repository();
    await expect(createInsightService({ repository: repo }).dashboard("manager", { id: "manager-user", role: "manager" }, { period: "month" })).resolves.toMatchObject({ role: "manager", metrics: { revenueVnd: "500000", occupancyRate: 40, attendanceRate: 80 }, alerts: { pendingPayments: 3, expiringMemberships: 2 } });
    expect(repo.managerMetrics).toHaveBeenCalledTimes(2);
  });

  it("exports source-aligned revenue and attendance summaries as CSV", async () => {
    const service = createInsightService({ repository: repository() });
    const revenue = await service.exportReport("revenue", { period: "month" });
    const attendance = await service.exportReport("attendance", { period: "month", coachUserId: "coach-1" });
    expect(revenue.filename).toContain("doanh-thu");
    expect(revenue.content).toContain("Thực thu");
    expect(attendance.content).toContain("coach-1");
  });
});
