import { describe, expect, it, vi } from "vitest";
import { createBookingService } from "../src/modules/bookings/booking.service.js";

describe("booking service", () => {
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
