import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  class_sessions: { update: vi.fn(), findUnique: vi.fn() },
  class_change_requests: { findUnique: vi.fn(), update: vi.fn() },
  audit_logs: { create: vi.fn() },
  bookings: { updateManyAndReturn: vi.fn(), count: vi.fn() },
  members: { findMany: vi.fn() },
  notifications: { createMany: vi.fn(), create: vi.fn() },
};

vi.mock("../src/database.js", () => ({ prisma }));

const { classRepository } = await import("../src/modules/classes/index.js");

describe("class change notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    prisma.class_change_requests.findUnique.mockResolvedValue({ id: "change-1", status: "pending", type: "cancel", class_session_id: "class-1", requested_by: "coach-1" });
    prisma.class_sessions.findUnique.mockResolvedValue({ id: "class-1", status: "published" });
    prisma.bookings.updateManyAndReturn.mockResolvedValue([]);
  });

  it("does not reduce capacity below confirmed and attended seats", async () => {
    prisma.bookings.count.mockResolvedValue(12);
    await expect(classRepository.update("class-1", { capacity: 10 })).rejects.toMatchObject({ code: "CLASS_CAPACITY_BELOW_BOOKINGS" });
    expect(prisma.class_sessions.update).not.toHaveBeenCalled();
    expect(prisma.bookings.count).toHaveBeenCalledWith({ where: { class_session_id: "class-1", status: { in: ["confirmed", "attended"] } } });
  });

  it("allows capacity equal to occupied seats under the same class lock as booking creation", async () => {
    prisma.bookings.count.mockResolvedValue(12);
    prisma.class_sessions.update.mockResolvedValue({ id: "class-1", capacity: 12 });
    await expect(classRepository.update("class-1", { capacity: 12 })).resolves.toMatchObject({ capacity: 12 });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it("returns only members whose active bookings were cancelled", async () => {
    prisma.bookings.updateManyAndReturn.mockResolvedValue([
      { member_id: "member-active" },
      { member_id: "member-active" },
      { member_id: "member-waitlisted" },
    ]);

    prisma.members.findMany.mockResolvedValue([{ user_id: "member-user" }]);
    await classRepository.reviewChange("change-1", "approved", "reviewer", decision);
    expect(prisma.members.findMany).toHaveBeenCalledWith({ where: { id: { in: ["member-active", "member-waitlisted"] } }, select: { user_id: true } });
    expect(prisma.bookings.updateManyAndReturn).toHaveBeenCalledWith(expect.objectContaining({
      where: { class_session_id: "class-1", status: { in: ["confirmed", "waitlisted"] } },
      select: { member_id: true },
    }));
  });

  it("does not notify a member who cancelled before the class changed", async () => {
    prisma.members.findMany.mockResolvedValue([{ user_id: "user-active" }]);

    prisma.bookings.updateManyAndReturn.mockResolvedValue([{ member_id: "member-active" }]);
    await classRepository.reviewChange("change-1", "approved", "reviewer", decision);
    expect(prisma.members.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["member-active"] } },
      select: { user_id: true },
    });
    expect(prisma.notifications.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ recipient_user_id: "user-active" })] });
    prisma.notifications.createMany.mockClear();
    prisma.bookings.updateManyAndReturn.mockResolvedValue([]);
    await classRepository.reviewChange("change-1", "approved", "reviewer", decision);
    expect(prisma.notifications.createMany).not.toHaveBeenCalled();
  });

  it("rejects an already reviewed request before touching its class or bookings", async () => {
    prisma.class_change_requests.findUnique.mockResolvedValue({ status: "approved" });
    await expect(classRepository.reviewChange("change-1", "approved", "reviewer", decision)).rejects.toMatchObject({ code: "CLASS_CHANGE_UNAVAILABLE" });
    expect(prisma.class_sessions.update).not.toHaveBeenCalled();
    expect(prisma.bookings.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it("does not finish review when notifications fail", async () => {
    prisma.notifications.create.mockRejectedValueOnce(new Error("notification failed"));
    await expect(classRepository.reviewChange("change-1", "rejected", "reviewer", decision)).rejects.toThrow("notification failed");
    expect(prisma.class_change_requests.update).not.toHaveBeenCalled();
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
  });
});

const decision = { notification: { title: "Lớp học đã hủy", body: "Booking đã được hủy." }, audit: { action: "class.change_approved", summary: "Đã duyệt thay đổi lớp." } };
