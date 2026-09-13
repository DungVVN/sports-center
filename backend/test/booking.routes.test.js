import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const classId = "17d813e0-a5e7-48e8-92bb-81fa123a8240";
const bookingId = "64409e25-1169-48ef-b7c8-05adbc0e4b7f";

function authService(role = "member") {
  return { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "user-1", role }, permissions: ["booking.write"] }) };
}

function bookingService() {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: bookingId, status: "confirmed" }),
    cancel: vi.fn().mockResolvedValue({ id: bookingId, status: "cancelled" }),
  };
}

describe("Booking routes", () => {
  it("passes the authenticated actor to service and accepts member self-booking without memberId", async () => {
    const service = bookingService();
    await request(createApp({ authService: authService(), bookingService: service })).post("/api/v1/bookings").set("Authorization", "Bearer token").send({ classId }).expect(201);
    expect(service.create).toHaveBeenCalledWith({ classId }, { id: "user-1", role: "member" });
  });

  it("rejects malformed member id before it reaches the booking service", async () => {
    const service = bookingService();
    const response = await request(createApp({ authService: authService(), bookingService: service })).get("/api/v1/bookings?memberId=not-a-uuid").set("Authorization", "Bearer token").expect(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(service.list).not.toHaveBeenCalled();
  });

  it("requires booking permission", async () => {
    const service = bookingService();
    const noPermission = { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "user-1", role: "member" }, permissions: [] }) };
    await request(createApp({ authService: noPermission, bookingService: service })).post("/api/v1/bookings").set("Authorization", "Bearer token").send({ classId }).expect(403);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("passes cancellation reason and actor to service", async () => {
    const service = bookingService();
    await request(createApp({ authService: authService(), bookingService: service })).patch(`/api/v1/bookings/${bookingId}/cancel`).set("Authorization", "Bearer token").send({ reason: "Đổi lịch làm việc" }).expect(200);
    expect(service.cancel).toHaveBeenCalledWith(bookingId, "Đổi lịch làm việc", { id: "user-1", role: "member" });
  });
});
