import { describe, expect, it, vi } from "vitest";
import { createMembershipService } from "../src/modules/memberships/membership.service.js";

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
