import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  payments: { count: vi.fn() },
  class_sessions: { count: vi.fn(), findMany: vi.fn() },
  member_coach_assignments: { findMany: vi.fn() },
  pt_purchases: { findMany: vi.fn() },
  bookings: { findMany: vi.fn() },
  training_plans: { count: vi.fn() },
}));
vi.mock("../src/database.js", () => ({ prisma }));
import { insightRepository } from "../src/modules/insights/index.js";

describe("role dashboard query scope", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts only pending cash for front desk but all pending methods for manager", async () => {
    await insightRepository.pendingCashPayments();
    await insightRepository.pendingPayments();
    expect(prisma.payments.count.mock.calls).toEqual([
      [{ where: { status: "pending", method: "cash" } }],
      [{ where: { status: "pending" } }],
    ]);
  });

  it("counts actual pending receipts owned by the member", async () => {
    await insightRepository.memberPendingPayments("member-2");
    expect(prisma.payments.count).toHaveBeenCalledWith({ where: { member_id: "member-2", status: "pending" } });
  });

  it("matches the assigned class list scope, excluding PT sessions", async () => {
    await insightRepository.coachClasses("coach-1");
    expect(prisma.class_sessions.count).toHaveBeenCalledWith({ where: { coach_user_id: "coach-1", pt_purchase_id: null } });
  });

  it("counts plans through the same assignment, booking and valid PT scope as training", async () => {
    prisma.member_coach_assignments.findMany.mockResolvedValue([{ member_id: "assigned" }]);
    prisma.class_sessions.findMany.mockResolvedValue([{ id: "class-1" }]);
    prisma.bookings.findMany.mockResolvedValue([{ member_id: "booked" }, { member_id: "assigned" }]);
    prisma.pt_purchases.findMany.mockResolvedValue([{ member_id: "pt-member" }]);
    prisma.training_plans.count.mockResolvedValue(3);
    expect(await insightRepository.coachTrainingPlans("coach-1")).toBe(3);
    expect(prisma.training_plans.count).toHaveBeenCalledWith({ where: { member_id: { in: ["assigned", "booked", "pt-member"] } } });
    expect(prisma.member_coach_assignments.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ coach_user_id: "coach-1", effective_from: { lte: expect.any(Date) } }) }));
    expect(prisma.bookings.findMany).toHaveBeenCalledWith({ where: { class_session_id: { in: ["class-1"] }, status: { in: ["confirmed", "waitlisted", "attended", "absent"] } }, select: { member_id: true } });
    expect(prisma.pt_purchases.findMany).toHaveBeenCalledWith({ where: { coach_user_id: "coach-1", status: "active", expires_at: { gte: expect.any(Date) } }, select: { member_id: true } });
  });
});
