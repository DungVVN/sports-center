import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  bookings: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
  class_sessions: { findUnique: vi.fn() },
  member_memberships: { findMany: vi.fn() },
  membership_freeze_requests: { findMany: vi.fn() },
  members: { findUnique: vi.fn() },
  notifications: { create: vi.fn() },
  membership_packages: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  membership_package_entitlements: {
    findMany: vi.fn(),
  },
};

vi.mock("../src/database.js", () => ({ prisma }));

const { bookingRepository } = await import("../src/modules/bookings/index.js");

describe("booking repository entitlement inheritance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    prisma.membership_freeze_requests.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.bookings.count.mockResolvedValue(0);
  });

  it("uses a lower-tier booking entitlement when the current package does not duplicate it", async () => {
    prisma.membership_packages.findUnique.mockResolvedValue({ tier_rank: 3 });
    prisma.membership_packages.findMany.mockResolvedValue([
      { id: "basic", tier_rank: 1 },
      { id: "premium", tier_rank: 3 },
    ]);
    prisma.membership_package_entitlements.findMany.mockResolvedValue([
      { package_id: "basic", entitlement: "group_class_booking" },
    ]);

    await expect(bookingRepository.entitlement("premium")).resolves.toEqual({
      package_id: "basic",
      entitlement: "group_class_booking",
    });
    expect(prisma.membership_package_entitlements.findMany).toHaveBeenCalledWith({
      where: {
        package_id: { in: ["basic", "premium"] },
        entitlement: "group_class_booking",
      },
    });
  });

  it("uses the closest tier configuration when a higher package overrides a lower entitlement", async () => {
    prisma.membership_packages.findUnique.mockResolvedValue({ tier_rank: 3 });
    prisma.membership_packages.findMany.mockResolvedValue([
      { id: "basic", tier_rank: 1 },
      { id: "premium", tier_rank: 3 },
    ]);
    prisma.membership_package_entitlements.findMany.mockResolvedValue([
      { package_id: "basic", entitlement: "group_class_booking", usage_limit: 2 },
      { package_id: "premium", entitlement: "group_class_booking", usage_limit: 5 },
    ]);

    await expect(bookingRepository.entitlement("premium")).resolves.toMatchObject({
      package_id: "premium",
      usage_limit: 5,
    });
  });

  it("notifies a member when a full class adds them to the waitlist", async () => {
    prisma.bookings.findFirst.mockResolvedValue(null);
    prisma.class_sessions.findUnique.mockResolvedValue({ capacity: 1 });
    prisma.bookings.count.mockResolvedValue(1);
    prisma.bookings.create.mockResolvedValue({ id: "booking-1", status: "waitlisted" });
    prisma.members.findUnique.mockResolvedValue({ user_id: "user-1" });

    await expect(bookingRepository.createWithCapacity({ bookingCode: "BKG-001", memberId: "member-1", classId: "class-1", bookedBy: "user-1" })).resolves.toMatchObject({ booking: { status: "waitlisted" } });
    expect(prisma.notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ recipient_user_id: "user-1", title: "Bạn đang trong danh sách chờ" }),
    }));
  });

  it("retries a serializable conflict so a concurrent booking can become waitlisted", async () => {
    prisma.$transaction
      .mockRejectedValueOnce(Object.assign(new Error("serialization conflict"), { code: "P2034" }))
      .mockImplementationOnce(async (callback) => callback(prisma));
    prisma.bookings.findFirst.mockResolvedValue(null);
    prisma.class_sessions.findUnique.mockResolvedValue({ capacity: 1 });
    prisma.bookings.count.mockResolvedValue(1);
    prisma.bookings.create.mockResolvedValue({ id: "booking-race", status: "waitlisted" });
    prisma.members.findUnique.mockResolvedValue({ user_id: "user-race" });

    await expect(bookingRepository.createWithCapacity({ bookingCode: "BKG-RACE", memberId: "member-race", classId: "class-race", bookedBy: "user-race" })).resolves.toMatchObject({ booking: { status: "waitlisted" } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("skips an ineligible waiter and confirms the earliest eligible waiter", async () => {
    prisma.class_sessions.findUnique.mockResolvedValue({ status: "published", capacity: 1, starts_at: new Date(Date.now() + 86400000) });
    prisma.bookings.findMany.mockResolvedValue([
      { id: "booking-ineligible", member_id: "member-ineligible" },
      { id: "booking-eligible", member_id: "member-eligible" },
    ]);
    prisma.member_memberships.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "membership-eligible", package_id: "premium" }]);
    prisma.membership_packages.findUnique.mockResolvedValue({ tier_rank: 3 });
    prisma.membership_packages.findMany.mockResolvedValue([{ id: "basic", tier_rank: 1 }, { id: "premium", tier_rank: 3 }]);
    prisma.membership_package_entitlements.findMany.mockResolvedValue([{ package_id: "basic", entitlement: "group_class_booking" }]);
    prisma.bookings.update.mockResolvedValue({ id: "booking-eligible", status: "confirmed" });
    prisma.members.findUnique.mockResolvedValue({ user_id: "user-eligible" });

    await expect(bookingRepository.promoteWaitlisted("class-1")).resolves.toMatchObject({ id: "booking-eligible", status: "confirmed" });
    expect(prisma.bookings.update).toHaveBeenCalledWith({ where: { id: "booking-eligible" }, data: { status: "confirmed" } });
    expect(prisma.notifications.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ recipient_user_id: "user-eligible", title: "Đã có chỗ trong lớp" }),
    }));
  });

  it("rejects a membership frozen on the future class date, not only one frozen today", async () => {
    const accessAt = new Date("2026-10-04T01:00:00.000Z");
    prisma.member_memberships.findMany.mockResolvedValue([{ id: "membership-frozen", package_id: "premium" }]);
    prisma.membership_freeze_requests.findMany.mockResolvedValue([{ membership_id: "membership-frozen" }]);

    await expect(bookingRepository.activeMembership("member-1", accessAt)).resolves.toBeNull();
    expect(prisma.membership_freeze_requests.findMany).toHaveBeenCalledWith({
      where: { membership_id: { in: ["membership-frozen"] }, status: "approved", starts_on: { lte: new Date("2026-10-04T00:00:00.000Z") }, ends_on: { gt: new Date("2026-10-04T00:00:00.000Z") } },
      select: { membership_id: true },
    });
  });

  it("uses another eligible membership when the later-expiring one is frozen", async () => {
    prisma.member_memberships.findMany.mockResolvedValue([
      { id: "membership-frozen", package_id: "premium" },
      { id: "membership-available", package_id: "basic" },
    ]);
    prisma.membership_freeze_requests.findMany.mockResolvedValue([{ membership_id: "membership-frozen" }]);

    await expect(bookingRepository.activeMembership("member-1", new Date("2026-10-04T01:00:00.000Z"))).resolves.toMatchObject({ id: "membership-available" });
  });

  it("skips a waitlisted member frozen on the class date", async () => {
    prisma.class_sessions.findUnique.mockResolvedValue({ status: "published", capacity: 1, starts_at: new Date(Date.now() + 86400000) });
    prisma.bookings.findMany.mockResolvedValue([{ id: "booking-frozen", member_id: "member-frozen" }]);
    prisma.member_memberships.findMany.mockResolvedValue([{ id: "membership-frozen", package_id: "premium" }]);
    prisma.membership_freeze_requests.findMany.mockResolvedValue([{ membership_id: "membership-frozen" }]);

    await expect(bookingRepository.promoteWaitlisted("class-1")).resolves.toBeNull();
    expect(prisma.bookings.update).not.toHaveBeenCalled();
  });

  it("does not promote when confirmed and attended bookings already fill the class", async () => {
    prisma.class_sessions.findUnique.mockResolvedValue({ status: "published", capacity: 1, starts_at: new Date(Date.now() + 86400000) });
    prisma.bookings.count.mockResolvedValue(1);
    await expect(bookingRepository.promoteWaitlisted("class-1")).resolves.toBeNull();
    expect(prisma.bookings.findMany).not.toHaveBeenCalled();
    expect(prisma.bookings.count).toHaveBeenCalledWith({ where: { class_session_id: "class-1", status: { in: ["confirmed", "attended"] } } });
  });

  it.each(["cancelled", "attended", "absent"])("does not cancel or promote a %s booking", async (status) => {
    prisma.class_sessions.findUnique.mockResolvedValue({ status: "published" });
    prisma.bookings.findUnique.mockResolvedValue({ id: "booking-1", status });
    await expect(bookingRepository.cancelAndPromote("booking-1", "class-1", "reason")).resolves.toBeNull();
    expect(prisma.bookings.updateMany).not.toHaveBeenCalled();
    expect(prisma.bookings.findMany).not.toHaveBeenCalled();
  });

  it("does not promote when the conditional cancellation loses a race", async () => {
    prisma.class_sessions.findUnique.mockResolvedValue({ status: "published" });
    prisma.bookings.findUnique.mockResolvedValue({ id: "booking-1", status: "confirmed" });
    prisma.bookings.updateMany.mockResolvedValue({ count: 0 });
    await expect(bookingRepository.cancelAndPromote("booking-1", "class-1", "reason")).resolves.toBeNull();
    expect(prisma.bookings.findMany).not.toHaveBeenCalled();
  });

  it("cancels a waitlisted booking without freeing a confirmed seat", async () => {
    prisma.class_sessions.findUnique.mockResolvedValue({ status: "published" });
    prisma.bookings.findUnique.mockResolvedValueOnce({ id: "booking-1", status: "waitlisted" }).mockResolvedValueOnce({ id: "booking-1", status: "cancelled" });
    prisma.bookings.updateMany.mockResolvedValue({ count: 1 });
    await expect(bookingRepository.cancelAndPromote("booking-1", "class-1", "reason")).resolves.toMatchObject({ status: "cancelled", promotedBookingId: null });
    expect(prisma.bookings.findMany).not.toHaveBeenCalled();
  });
});
