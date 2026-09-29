import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  bookings: { updateManyAndReturn: vi.fn() },
  members: { findMany: vi.fn() },
  notifications: { createMany: vi.fn() },
};

vi.mock("../src/database.js", () => ({ prisma }));

const { classRepository } = await import("../src/modules/classes/index.js");

describe("class change notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only members whose active bookings were cancelled", async () => {
    prisma.bookings.updateManyAndReturn.mockResolvedValue([
      { member_id: "member-active" },
      { member_id: "member-active" },
      { member_id: "member-waitlisted" },
    ]);

    await expect(classRepository.cancelBookings("class-1")).resolves.toEqual(["member-active", "member-waitlisted"]);
    expect(prisma.bookings.updateManyAndReturn).toHaveBeenCalledWith(expect.objectContaining({
      where: { class_session_id: "class-1", status: { in: ["confirmed", "waitlisted"] } },
      select: { member_id: true },
    }));
  });

  it("does not notify a member who cancelled before the class changed", async () => {
    prisma.members.findMany.mockResolvedValue([{ user_id: "user-active" }]);

    await classRepository.notifyClassMembers("class-1", ["member-active"], "Lớp học đã hủy", "Booking đã được hủy.");
    expect(prisma.members.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["member-active"] } },
      select: { user_id: true },
    });
    expect(prisma.notifications.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ recipient_user_id: "user-active" })] });
    prisma.notifications.createMany.mockClear();
    await classRepository.notifyClassMembers("class-1", [], "Lớp học đã hủy", "Booking đã được hủy.");
    expect(prisma.notifications.createMany).not.toHaveBeenCalled();
  });
});
