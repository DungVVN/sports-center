import { describe, expect, it, vi } from "vitest";
import { createInsightService } from "../src/modules/insights/insight.service.js";

function repository() { return { revenue: vi.fn().mockResolvedValue([{ status: "paid", _sum: { amount_vnd: BigInt(500000) }, _count: { id: 1 } }]), paymentStatuses: vi.fn().mockResolvedValue([{ status: "pending", _sum: { amount_vnd: BigInt(300000) }, _count: { id: 2 } }]), todayClasses: vi.fn().mockResolvedValue(4), pendingPayments: vi.fn().mockResolvedValue(3), expiring: vi.fn().mockResolvedValue([{}, {}]), coachTodayClasses: vi.fn().mockResolvedValue(2), memberByUser: vi.fn().mockResolvedValue({ id: "member-1" }), memberTodayClasses: vi.fn().mockResolvedValue(1), memberPendingMemberships: vi.fn().mockResolvedValue(1), memberExpiringMemberships: vi.fn().mockResolvedValue(1), managerMetrics: vi.fn().mockResolvedValue({ revenueVnd: "500000", newMembers: 2, classes: 3, bookings: 4, capacity: 10, attendance: { present: 3, late: 1, absent: 1, marked: 5 } }), revenuePayments: vi.fn().mockResolvedValue([]) }; }

describe("Insight dashboard service", () => {
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
});
