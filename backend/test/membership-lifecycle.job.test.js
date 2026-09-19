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
      membership_renewal_reminders: { create: vi.fn() },
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

  it("records one pre-expiry renewal reminder per membership and day even when the job retries", async () => {
    const membership = { id: "membership-1", member_id: "member-1", expires_on: new Date("2026-09-17T00:00:00.000Z") };
    const duplicate = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    const database = {
      membership_freeze_requests: { findMany: vi.fn().mockResolvedValue([]) },
      member_memberships: {
        findMany: vi.fn()
          .mockResolvedValueOnce([membership]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
          .mockResolvedValueOnce([membership]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]),
        update: vi.fn().mockResolvedValue(undefined), updateMany: vi.fn().mockResolvedValue(undefined),
      },
      membership_renewal_reminders: { create: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(duplicate) },
      members: { findUnique: vi.fn().mockResolvedValue({ user_id: "user-1" }) },
      notifications: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(undefined) },
      class_sessions: { findMany: vi.fn().mockResolvedValue([]) }, bookings: { findMany: vi.fn().mockResolvedValue([]) },
      attendance_records: { findMany: vi.fn().mockResolvedValue([]) }, training_plans: { findMany: vi.fn().mockResolvedValue([]) },
    };
    database.$transaction = vi.fn(async (callback) => callback(database));
    const now = new Date("2026-09-10T12:00:00.000Z");

    await expect(runMembershipLifecycleJob(now, database)).resolves.toMatchObject({ renewalReminders: 1 });
    await expect(runMembershipLifecycleJob(now, database)).resolves.toMatchObject({ renewalReminders: 0 });
    expect(database.membership_renewal_reminders.create).toHaveBeenCalledTimes(2);
    expect(database.notifications.create).toHaveBeenCalledTimes(1);
    expect(database.$transaction).toHaveBeenCalledTimes(2);
  });
});
