import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/database.js";
import { listPaymentTargets } from "../src/modules/payments/infrastructure/payment-target.repository.js";

vi.mock("../src/database.js", () => ({ prisma: Object.fromEntries(["member_memberships", "course_enrollments", "pt_purchases", "facility_reservations", "payments", "courses", "facility_days", "facilities"].map((name) => [name, { findMany: vi.fn() }])) }));

describe("Payment targets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const model of Object.values(prisma)) model.findMany.mockResolvedValue([]);
  });

  it("uses each service's snapshot and excludes targets with an existing pending or paid receipt", async () => {
    prisma.member_memberships.findMany.mockResolvedValue([{ id: "membership-1", package_name_snapshot: "Gold", price_vnd_snapshot: 500000n }]);
    prisma.course_enrollments.findMany.mockResolvedValue([{ id: "course-1", course_id: "catalog-1", price_vnd_snapshot: 250000n }]);
    prisma.courses.findMany.mockResolvedValue([{ id: "catalog-1", name: "Yoga" }]);
    prisma.pt_purchases.findMany.mockResolvedValue([{ id: "pt-1", package_name_snapshot: "PT", price_vnd_snapshot: 700000n }]);
    prisma.facility_reservations.findMany.mockResolvedValue([{ id: "rental-1", day_id: "day-1", total_vnd_snapshot: 150000n, requested_start_minute: 600, requested_end_minute: 660, assigned_start_minute: 720, assigned_end_minute: 780 }]);
    prisma.facility_days.findMany.mockResolvedValue([{ id: "day-1", facility_id: "facility-1", open_on: new Date("2026-10-04") }]);
    prisma.facilities.findMany.mockResolvedValue([{ id: "facility-1", name: "Sân A" }]);
    expect(await listPaymentTargets({ id: "member-1", user_id: "user-1" })).toEqual([
      { id: "membership-1", targetField: "membershipId", name: "Gold", amountVnd: "500000" },
      { id: "course-1", targetField: "courseEnrollmentId", name: "Yoga", amountVnd: "250000" },
      { id: "pt-1", targetField: "ptPurchaseId", name: "PT", amountVnd: "700000" },
      { id: "rental-1", targetField: "facilityReservationId", name: "Sân A — 2026-10-04 12:00–13:00", amountVnd: "150000" },
    ]);
    prisma.payments.findMany.mockResolvedValue([{ membership_id: "membership-1", pt_purchase_id: "pt-1" }, { course_enrollment_id: "course-1", facility_reservation_id: "rental-1" }]);
    expect(await listPaymentTargets({ id: "member-1", user_id: "user-1" })).toEqual([]);
    expect(prisma.payments.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { member_id: "member-1", status: { in: ["pending", "paid"] } } }));
  });

  it("restricts candidates to the member and unpaid eligible states, including the course deadline", async () => {
    const startedAt = new Date();
    await listPaymentTargets({ id: "member-1", user_id: "user-1" });
    for (const model of [prisma.member_memberships, prisma.pt_purchases]) {
      expect(model.findMany).toHaveBeenCalledWith({ where: { member_id: "member-1", status: "pending_payment", price_vnd_snapshot: { gt: 0n } } });
    }
    const courseWhere = prisma.course_enrollments.findMany.mock.calls[0][0].where;
    expect(courseWhere).toMatchObject({ member_id: "member-1", status: "pending_payment", price_vnd_snapshot: { gt: 0n }, OR: [{ payment_expires_at: null }, { payment_expires_at: { gt: expect.any(Date) } }] });
    expect(courseWhere.OR[1].payment_expires_at.gt >= startedAt).toBe(true);
    expect(prisma.facility_reservations.findMany).toHaveBeenCalledWith({ where: { requester_user_id: "user-1", status: "approved", payment_state: "unpaid", total_vnd_snapshot: { gt: 0n } } });
    prisma.facility_reservations.findMany.mockClear();
    await listPaymentTargets({ id: "member-2", user_id: null });
    expect(prisma.facility_reservations.findMany).not.toHaveBeenCalled();
  });
});
