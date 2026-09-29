import { describe, expect, it, vi } from "vitest";
import { createMembershipService } from "../src/modules/memberships/index.js";

describe("public membership packages", () => {
  it("identifies a duplicate package code for the form", async () => {
    const repository = { createPackage: vi.fn().mockRejectedValue({ code: "P2002", meta: { target: ["code"] } }) };
    const service = createMembershipService({ repository, auditService: { record: vi.fn() } });
    await expect(service.createPackage({ code: "STANDARD", name: "Tiêu chuẩn", priceVnd: "100000", durationDays: 30, tierRank: 1 }, "manager-1"))
      .rejects.toMatchObject({ statusCode: 409, code: "MEMBERSHIP_PACKAGE_CODE_EXISTS" });
  });

  it("returns only display fields and converts bigint prices", async () => {
    const repository = { publicPackages: vi.fn().mockResolvedValue([{ code: "PREMIUM", name: "Cao cấp", price_vnd: 2490000n, duration_days: 365, benefits: ["Hồ bơi"], id: "private-id", is_active: true }]) };
    const service = createMembershipService({ repository, auditService: {} });
    await expect(service.listPublicPackages()).resolves.toEqual([{ code: "PREMIUM", name: "Cao cấp", priceVnd: "2490000", durationDays: 365, benefits: ["Hồ bơi"] }]);
  });
});

describe("membership assignment", () => {
  it("activates a free package without creating a payment", async () => {
    const repository = {
      memberExists: vi.fn().mockResolvedValue({ id: "member-1" }),
      packageById: vi.fn().mockResolvedValue({ id: "free-1", name: "Gói miễn phí", price_vnd: 0n, duration_days: 30, is_active: true }),
      createMembership: vi.fn().mockImplementation(async (data) => ({ id: "membership-1", ...data })),
    };
    const auditService = { record: vi.fn() };
    const service = createMembershipService({ repository, auditService });

    await expect(service.createMemberMembership({ memberId: "member-1", packageId: "free-1", startsOn: "2026-10-01" }, "admin-1"))
      .resolves.toMatchObject({ id: "membership-1", status: "active", priceVnd: "0" });
    expect(repository.createMembership).toHaveBeenCalledWith(expect.objectContaining({ status: "active", activated_at: expect.any(Date), price_vnd_snapshot: 0n }));
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "membership.free_activated" }));
  });

  it("keeps paid packages awaiting payment", async () => {
    const repository = {
      memberExists: vi.fn().mockResolvedValue({ id: "member-1" }),
      packageById: vi.fn().mockResolvedValue({ id: "paid-1", name: "Gói trả phí", price_vnd: 100000n, duration_days: 30, is_active: true }),
      createMembership: vi.fn().mockImplementation(async (data) => ({ id: "membership-1", status: "pending_payment", ...data })),
    };
    const service = createMembershipService({ repository, auditService: { record: vi.fn() } });

    await expect(service.createMemberMembership({ memberId: "member-1", packageId: "paid-1", startsOn: "2026-10-01" }, "admin-1"))
      .resolves.toMatchObject({ status: "pending_payment", priceVnd: "100000" });
    expect(repository.createMembership).toHaveBeenCalledWith(expect.not.objectContaining({ status: "active" }));
  });
});

describe("membership freeze review", () => {
  it("extends the membership before approving a valid freeze request", async () => {
    const repository = {
      freezeRequest: vi.fn().mockResolvedValue({ id: "freeze-1", status: "pending", membership_id: "membership-1", starts_on: new Date("2026-10-01T00:00:00.000Z"), ends_on: new Date("2026-10-15T00:00:00.000Z") }),
      membership: vi.fn().mockResolvedValue({ id: "membership-1", status: "active", expires_on: new Date("2026-11-01T00:00:00.000Z") }),
      extendForFreeze: vi.fn().mockResolvedValue(undefined),
      approveFreeze: vi.fn().mockResolvedValue({ id: "freeze-1", status: "approved" }),
      notifyMember: vi.fn().mockResolvedValue(undefined),
    };
    const service = createMembershipService({ repository, auditService: { record: vi.fn().mockResolvedValue(undefined) } });

    await expect(service.reviewFreeze("freeze-1", true, "receptionist-1")).resolves.toMatchObject({ status: "approved" });
    expect(repository.extendForFreeze).toHaveBeenCalledWith("membership-1", new Date("2026-11-15T00:00:00.000Z"), 14);
    expect(repository.extendForFreeze.mock.invocationCallOrder[0]).toBeLessThan(repository.approveFreeze.mock.invocationCallOrder[0]);
    expect(repository.notifyMember).toHaveBeenCalledWith("membership-1", expect.stringContaining("duyệt"), expect.any(String));
  });
});
