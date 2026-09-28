import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  attendance_records: { findUnique: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("../src/database.js", () => ({ prisma }));
import { attendanceRepository } from "../src/modules/attendance/attendance.repository.js";

describe("attendance repository timestamps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the original check-in time when the same booking is checked in again", async () => {
    const original = new Date("2026-09-27T08:00:00Z");
    prisma.attendance_records.upsert.mockResolvedValue({ id: "record-1", checked_in_at: original });
    await attendanceRepository.upsert({ classSessionId: "session-1", memberId: "member-1", bookingId: "booking-1", status: "present", checkedInAt: new Date("2026-09-27T08:05:00Z"), actor: "coach-1" });
    expect(prisma.attendance_records.upsert.mock.calls[0][0].update).not.toHaveProperty("checked_in_at");
    expect(prisma.attendance_records.updateMany).not.toHaveBeenCalled();
  });

  it("sets an empty check-in timestamp only once under concurrent requests", async () => {
    const checkedInAt = new Date("2026-09-27T08:05:00Z");
    prisma.attendance_records.upsert.mockResolvedValue({ id: "record-1", checked_in_at: null });
    prisma.attendance_records.findUnique.mockResolvedValue({ id: "record-1", checked_in_at: checkedInAt });
    await attendanceRepository.upsert({ classSessionId: "session-1", memberId: "member-1", bookingId: "booking-1", status: "present", checkedInAt, actor: "coach-1" });
    expect(prisma.attendance_records.updateMany).toHaveBeenCalledWith({ where: { id: "record-1", checked_in_at: null }, data: { checked_in_at: checkedInAt } });
  });

  it("preserves a recorded check-in when finalizing attendance", async () => {
    const original = new Date("2026-09-27T08:00:00Z");
    const tx = {
      class_sessions: { findUnique: vi.fn().mockResolvedValue({ id: "session-1", name: "Yoga" }) },
      bookings: { findMany: vi.fn().mockResolvedValue([{ id: "booking-1", member_id: "member-1" }]) },
      attendance_submissions: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "submission-1" }) },
      attendance_records: { findMany: vi.fn().mockResolvedValue([{ member_id: "member-1", checked_in_at: original }]), upsert: vi.fn().mockResolvedValue({ id: "record-1" }) },
      members: { findMany: vi.fn().mockResolvedValue([]) },
      notifications: { createMany: vi.fn() },
    };
    prisma.$transaction.mockImplementation((action) => action(tx));
    await attendanceRepository.submit("session-1", [{ bookingId: "booking-1", status: "present" }], "coach-1");
    expect(tx.attendance_records.upsert.mock.calls[0][0].update.checked_in_at).toEqual(original);
  });
});
