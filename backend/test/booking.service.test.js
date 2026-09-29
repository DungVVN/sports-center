import { describe, expect, it, vi } from "vitest";
import { createBookingService } from "../src/modules/bookings/index.js";

describe("booking service", () => {
  it("limits a Coach booking list to classes they are assigned to", async () => {
    const repository = { list: vi.fn().mockResolvedValue([]) };
    const service = createBookingService({ repository, auditService: { record: vi.fn() } });

    await service.list(undefined, { id: "coach-1", role: "coach" });

    expect(repository.list).toHaveBeenCalledWith({ memberId: undefined, coachUserId: "coach-1" });
  });

  it("limits a Member booking list to their own member profile", async () => {
    const repository = {
      memberByUser: vi.fn().mockResolvedValue({ id: "member-1" }),
      list: vi.fn().mockResolvedValue([]),
    };
    const service = createBookingService({ repository, auditService: { record: vi.fn() } });

    await service.list(undefined, { id: "member-user-1", role: "member" });

    expect(repository.list).toHaveBeenCalledWith({ memberId: "member-1", coachUserId: undefined });
  });

  it("does not expose other members' bookings when a Member views a class", async () => {
    const repository = {
      class: vi.fn().mockResolvedValue({ id: "class-1", coach_user_id: "coach-1" }),
      memberByUser: vi.fn().mockResolvedValue({ id: "member-1" }),
      listForClass: vi.fn().mockResolvedValue([]),
    };
    const service = createBookingService({ repository, auditService: { record: vi.fn() } });

    await service.listForClass("class-1", { id: "member-user-1", role: "member" });

    expect(repository.listForClass).toHaveBeenCalledWith("class-1", "member-1");
  });

  it("checks membership eligibility at the scheduled class time", async () => {
    const repository = {
      member: vi.fn().mockResolvedValue({ id: "member-1" }),
      class: vi.fn().mockResolvedValue({ id: "class-1", status: "published", starts_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }),
      activeMembership: vi.fn().mockResolvedValue(null),
      entitlement: vi.fn(),
    };
    const service = createBookingService({ repository, auditService: { record: vi.fn() } });
    await expect(service.create({ memberId: "member-1", classId: "class-1" }, { id: "receptionist-1", role: "receptionist" })).rejects.toMatchObject({ code: "MEMBERSHIP_BOOKING_NOT_ELIGIBLE" });
    expect(repository.activeMembership).toHaveBeenCalledWith("member-1", expect.any(Date));
  });

  it("allows a higher-tier package when its resolved inherited booking entitlement exists", async () => {
    const repository = {
      member: vi.fn().mockResolvedValue({ id: "member-1" }),
      class: vi.fn().mockResolvedValue({ id: "class-1", status: "published", starts_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }),
      activeMembership: vi.fn().mockResolvedValue({ package_id: "premium-package" }),
      entitlement: vi.fn().mockResolvedValue({ package_id: "basic-package", entitlement: "group_class_booking" }),
      createWithCapacity: vi.fn().mockResolvedValue({ duplicate: false, booking: { id: "booking-1", status: "confirmed" } }),
    };
    const auditService = { record: vi.fn().mockResolvedValue(undefined) };
    const service = createBookingService({ repository, auditService });

    await expect(service.create({ memberId: "member-1", classId: "class-1" }, { id: "receptionist-1", role: "receptionist" })).resolves.toMatchObject({ id: "booking-1" });
    expect(repository.entitlement).toHaveBeenCalledWith("premium-package");
    expect(repository.createWithCapacity).toHaveBeenCalledWith(expect.objectContaining({ memberId: "member-1", classId: "class-1" }));
  });

  it("allows a receptionist to cancel a booking inside the member self-cancellation window", async () => {
    const repository = {
      find: vi.fn().mockResolvedValue({ id: "booking-1", status: "confirmed", member_id: "member-1", class_session_id: "class-1" }),
      class: vi.fn().mockResolvedValue({ starts_at: new Date(Date.now() + 60 * 60 * 1000) }),
      cancel: vi.fn().mockResolvedValue({ id: "booking-1", status: "cancelled" }),
      promoteWaitlisted: vi.fn().mockResolvedValue(null),
    };
    const service = createBookingService({ repository, auditService: { record: vi.fn().mockResolvedValue(undefined) } });
    await expect(service.cancel("booking-1", "Hỗ trợ vận hành", { id: "receptionist-1", role: "receptionist" })).resolves.toMatchObject({ status: "cancelled" });
  });
});
