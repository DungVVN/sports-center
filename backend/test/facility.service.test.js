import { describe, expect, it, vi } from "vitest";
import { createFacilityService } from "../src/modules/facilities/index.js";

const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
const dateText = date.toISOString().slice(0, 10);
const auditService = { record: vi.fn() };

describe("facility calendar service", () => {
  it("rejects a member cancelling somebody else's reservation before any mutation", async () => {
    const repo = { reservation: vi.fn().mockResolvedValue({ requester_user_id: "other-member" }), cancel: vi.fn(), requestCancellation: vi.fn() };
    const service = createFacilityService({ repository: repo, auditService });
    await expect(service.cancel("res-1", "Đổi lịch sân", "member-1", "member")).rejects.toMatchObject({ statusCode: 403, code: "FACILITY_CANCELLATION_DENIED" });
    expect(repo.cancel).not.toHaveBeenCalled();
    expect(repo.requestCancellation).not.toHaveBeenCalled();
  });
  it("lets a member cancel their own reservation", async () => {
    const repo = { reservation: vi.fn().mockResolvedValue({ requester_user_id: "member-1" }), cancel: vi.fn().mockResolvedValue({ kind: "updated", item: { status: "cancelled" } }) };
    await expect(createFacilityService({ repository: repo, auditService }).cancel("res-1", "Đổi lịch sân", "member-1", "member")).resolves.toMatchObject({ status: "cancelled" });
  });
  it("returns free and booked periods without personal data", async () => {
    const repository = {
      types: vi.fn().mockResolvedValue([{ id: "type-1", name: "Sân bóng", is_active: true }]),
      facilities: vi.fn().mockResolvedValue([{ id: "court-1", type_id: "type-1", name: "Sân A", open_minute: 360, close_minute: 720, is_active: true }]),
      days: vi.fn().mockResolvedValue([{ id: "day-1", facility_id: "court-1", open_on: date }]),
      approved: vi.fn().mockResolvedValue([{ day_id: "day-1", assigned_start_minute: 480, assigned_end_minute: 540, member_id: "private", contact_phone: "0901234567" }]),
    };
    const result = await createFacilityService({ repository, auditService }).publicCalendar({ from: dateText, to: dateText });
    expect(result.days[0]).toEqual({ id: "day-1", facilityId: "court-1", date: dateText, free: [{ startMinute: 360, endMinute: 480 }, { startMinute: 540, endMinute: 720 }], booked: [{ startMinute: 480, endMinute: 540 }] });
    expect(JSON.stringify(result)).not.toMatch(/private|0901234567/);
  });

  it("refuses a booking from an unavailable account", async () => {
    const repository = { requester: vi.fn().mockResolvedValue(null), request: vi.fn() };
    await expect(createFacilityService({ repository, auditService }).request({ dayId: "day-1" }, "user-1")).rejects.toMatchObject({ code: "FACILITY_REQUESTER_UNAVAILABLE", statusCode: 403 });
    expect(repository.request).not.toHaveBeenCalled();
  });

  it("accepts a request from any active account granted the permission", async () => {
    const repository = {
      requester: vi.fn().mockResolvedValue({ id: "user-1", display_name: "Nguyễn Minh", status: "active" }),
      day: vi.fn().mockResolvedValue({ id: "day-1", facility_id: "court-1", open_on: new Date("2099-09-25T00:00:00Z") }),
      facility: vi.fn().mockResolvedValue({ id: "court-1", type_id: "type-1", is_active: true, open_minute: 360, close_minute: 720 }),
      type: vi.fn().mockResolvedValue({ id: "type-1", is_active: true }),
      request: vi.fn().mockResolvedValue({ kind: "created", item: { id: "reservation-1", status: "pending" } }),
    };
    const input = { dayId: "day-1", startMinute: 480, endMinute: 540, participantCount: 4, phone: "0901234567" };
    await expect(createFacilityService({ repository, auditService }).request(input, "user-1")).resolves.toMatchObject({ status: "pending" });
    expect(repository.request).toHaveBeenCalledWith({ ...input, requesterUserId: "user-1", actorUserId: "user-1" });
  });

  it("maps conflicting approvals to a stable 409 error", async () => {
    const repository = {
      reservation: vi.fn().mockResolvedValue({ id: "res-1", day_id: "day-1", requested_start_minute: 480, requested_end_minute: 540 }),
      day: vi.fn().mockResolvedValue({ id: "day-1", facility_id: "court-1", open_on: new Date("2099-09-25T00:00:00Z") }),
      facility: vi.fn().mockResolvedValue({ open_minute: 360, close_minute: 720 }),
      review: vi.fn().mockRejectedValue(Object.assign(new Error("facility_approved_no_overlap"), { code: "P2004" })),
    };
    await expect(createFacilityService({ repository, auditService }).review("res-1", { approved: true }, "receptionist-1")).rejects.toMatchObject({ code: "FACILITY_TIME_BOOKED", statusCode: 409 });
  });

  it("requires the creator to confirm a cancellation requested by another permitted user", async () => {
    const repository = {
      reservation: vi.fn()
        .mockResolvedValueOnce({ id: "res-1", requester_user_id: "member-1", status: "approved" })
        .mockResolvedValueOnce({ id: "res-1", requester_user_id: "member-1", status: "approved", cancellation_reason: "Đổi lịch sân" })
        .mockResolvedValueOnce({ id: "res-1", requester_user_id: "member-1", status: "approved", cancellation_reason: "Đổi lịch sân" }),
      requestCancellation: vi.fn().mockResolvedValue({ kind: "requested", item: { id: "res-1", cancellation_requested_at: new Date() } }),
      confirmCancellation: vi.fn().mockResolvedValue({ kind: "updated", item: { id: "res-1", status: "cancelled" } }),
      cancel: vi.fn(),
    };
    const service = createFacilityService({ repository, auditService: { record: vi.fn() } });

    await expect(service.cancel("res-1", "Đổi lịch sân", "receptionist-1")).resolves.toMatchObject({ cancellationPending: true });
    expect(repository.requestCancellation).toHaveBeenCalledWith({ id: "res-1", reason: "Đổi lịch sân", actorUserId: "receptionist-1" });
    await expect(service.confirmCancellation("res-1", "member-1")).resolves.toMatchObject({ status: "cancelled" });
    await expect(service.confirmCancellation("res-1", "another-member")).rejects.toMatchObject({ code: "FACILITY_CANCELLATION_CONFIRMATION_DENIED", statusCode: 403 });
  });

  it("treats a retained cancellation request as completed once the reservation is cancelled", async () => {
    const repository = {
      mine: vi.fn().mockResolvedValue([{ id: "res-1", day_id: "day-1", status: "cancelled", cancellation_requested_at: new Date(), cancellation_reason: "Đổi lịch sân" }]),
      daysByIds: vi.fn().mockResolvedValue([{ id: "day-1", facility_id: "court-1", open_on: date }]),
      facilitiesByIds: vi.fn().mockResolvedValue([{ id: "court-1", name: "Sân A" }]),
    };
    await expect(createFacilityService({ repository, auditService }).mine("member-1")).resolves.toMatchObject([{ status: "cancelled", cancellationPending: false }]);
  });

});
