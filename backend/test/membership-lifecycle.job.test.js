import { describe, expect, it, vi } from "vitest";
import { runMembershipLifecycleJob } from "../src/jobs/membership-lifecycle.job.js";

describe("membership lifecycle job", () => {
  it("starts a grace window exactly 72 hours after contractual expiry", async () => {
    const expiresOn = new Date("2026-09-10T00:00:00.000Z");
    const database = {
      membership_freeze_requests: { findMany: vi.fn().mockResolvedValue([]) },
      member_memberships: {
        findMany: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: "membership-1", member_id: "member-1", expires_on: expiresOn }])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
        update: vi.fn().mockResolvedValue(undefined),
        updateMany: vi.fn().mockResolvedValue(undefined),
      },
      members: { findUnique: vi.fn().mockResolvedValue(null) },
      notifications: { findFirst: vi.fn(), create: vi.fn() },
      class_sessions: { findMany: vi.fn().mockResolvedValue([]) },
      bookings: { findMany: vi.fn() },
      attendance_records: { findMany: vi.fn().mockResolvedValue([]) },
      training_plans: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await runMembershipLifecycleJob(new Date("2026-09-12T12:00:00.000Z"), database);

    expect(database.member_memberships.update).toHaveBeenCalledWith({
      where: { id: "membership-1" },
      data: { grace_expires_at: new Date("2026-09-13T00:00:00.000Z"), status: "expiring_soon" },
    });
  });
});
