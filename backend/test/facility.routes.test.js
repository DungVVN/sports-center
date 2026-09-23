import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const dayId = "11111111-1111-4111-8111-111111111111";
const reservationId = "22222222-2222-4222-8222-222222222222";
const auth = (permissions = [], role = "member") => ({ getAuthentication: vi.fn().mockResolvedValue({ user: { id: "member-user", role }, permissions }) });
const service = () => ({ publicCalendar: vi.fn().mockResolvedValue({ types: [], facilities: [], days: [] }), request: vi.fn().mockResolvedValue({ id: reservationId, status: "pending" }), mine: vi.fn().mockResolvedValue([]), reservations: vi.fn().mockResolvedValue([]), review: vi.fn().mockResolvedValue({ id: reservationId, status: "approved" }), cancel: vi.fn().mockResolvedValue({ id: reservationId, status: "cancelled" }) });

describe("facility reservation routes", () => {
  it("exposes only the public calendar without authentication", async () => {
    const facilityService = service();
    const response = await request(createApp({ authService: auth(), facilityService })).get("/api/v1/public/facility-calendar?from=2026-09-24&to=2026-09-30").expect(200);
    expect(response.body.data).toEqual({ types: [], facilities: [], days: [] });
    expect(facilityService.publicCalendar).toHaveBeenCalledWith({ from: "2026-09-24", to: "2026-09-30" });
    await request(createApp({ authService: auth(), facilityService })).get("/api/v1/public/facility-calendar?from=2026-09-24&to=2026-11-30").expect(422);
  });

  it("requires login and request permission for member booking", async () => {
    const facilityService = service();
    const body = { dayId, startMinute: 480, endMinute: 540, participantCount: 6, phone: "0901234567" };
    await request(createApp({ authService: auth(), facilityService })).post("/api/v1/facility-reservations").send(body).expect(401);
    await request(createApp({ authService: auth(), facilityService })).post("/api/v1/facility-reservations").set("Authorization", "Bearer token").send(body).expect(403);
    const response = await request(createApp({ authService: auth(["facility.booking.request"], "coach"), facilityService })).post("/api/v1/facility-reservations").set("Authorization", "Bearer token").send(body).expect(201);
    expect(response.body.data.status).toBe("pending");
    expect(facilityService.request).toHaveBeenCalledWith(body, "member-user");
    await request(createApp({ authService: auth(["facility.booking.request"]), facilityService })).post("/api/v1/facility-reservations").set("Authorization", "Bearer token").send({ ...body, endMinute: 470 }).expect(422);
  });

  it("separates detail, approval and cancellation permissions", async () => {
    const facilityService = service();
    const app = createApp({ authService: auth(["facility.booking.read"]), facilityService });
    await request(app).get("/api/v1/facility-reservations").set("Authorization", "Bearer token").expect(200);
    await request(app).patch(`/api/v1/facility-reservations/${reservationId}/review`).set("Authorization", "Bearer token").send({ approved: true }).expect(403);
    await request(app).patch(`/api/v1/facility-reservations/${reservationId}/cancel`).set("Authorization", "Bearer token").send({ reason: "Đổi lịch" }).expect(403);
    const reviewer = createApp({ authService: auth(["facility.booking.approve"]), facilityService });
    await request(reviewer).patch(`/api/v1/facility-reservations/${reservationId}/review`).set("Authorization", "Bearer token").send({ approved: false }).expect(422);
    await request(reviewer).patch(`/api/v1/facility-reservations/${reservationId}/review`).set("Authorization", "Bearer token").send({ approved: true, startMinute: 540, endMinute: 600 }).expect(200);
  });
});
