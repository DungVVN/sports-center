import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const classId = "11111111-1111-4111-8111-111111111111";
const bookingId = "22222222-2222-4222-8222-222222222222";
const attendanceId = "33333333-3333-4333-8333-333333333333";
const actorId = "44444444-4444-4444-8444-444444444444";

function authService(permissions, role = "coach") { return { getAuthentication: vi.fn().mockResolvedValue({ user: { id: actorId, role }, permissions }) }; }
function attendanceService() { return { ownRecords: vi.fn().mockResolvedValue([]), list: vi.fn().mockResolvedValue([]), checkIn: vi.fn().mockResolvedValue({ id: attendanceId }), checkOut: vi.fn().mockResolvedValue({ id: attendanceId }), correct: vi.fn().mockResolvedValue({ id: attendanceId, status: "late" }) }; }

describe("Attendance routes", () => {
  it("lets a Member read only their own attendance history without attendance.write", async () => {
    const service = attendanceService();
    await request(createApp({ authService: authService([], "member"), attendanceService: service })).get("/api/v1/members/me/attendance").set("Authorization", "Bearer token").expect(200);
    expect(service.ownRecords).toHaveBeenCalledWith({ id: actorId, role: "member" });
  });
  it("lists attendance under the authenticated Coach scope", async () => {
    const service = attendanceService();
    await request(createApp({ authService: authService(["attendance.write"]), attendanceService: service })).get(`/api/v1/classes/${classId}/attendance`).set("Authorization", "Bearer token").expect(200);
    expect(service.list).toHaveBeenCalledWith(classId, { id: actorId, role: "coach" });
  });

  it("checks in a booking and records a correction with its reason", async () => {
    const service = attendanceService(); const app = createApp({ authService: authService(["attendance.write"]), attendanceService: service });
    await request(app).post("/api/v1/attendance/check-in").set("Authorization", "Bearer token").send({ bookingId }).expect(200);
    await request(app).post(`/api/v1/attendance/${attendanceId}/corrections`).set("Authorization", "Bearer token").send({ status: "late", reason: "Hội viên đến trễ do kẹt xe" }).expect(200);
    expect(service.checkIn).toHaveBeenCalledWith(bookingId, { id: actorId, role: "coach" });
    expect(service.correct).toHaveBeenCalledWith(attendanceId, "late", "Hội viên đến trễ do kẹt xe", { id: actorId, role: "coach" });
  });

  it("does not call attendance services without permission", async () => {
    const service = attendanceService();
    await request(createApp({ authService: authService([]), attendanceService: service })).post("/api/v1/attendance/check-in").set("Authorization", "Bearer token").send({ bookingId }).expect(403);
    expect(service.checkIn).not.toHaveBeenCalled();
  });

  it("validates correction status and reason", async () => {
    const service = attendanceService();
    await request(createApp({ authService: authService(["attendance.write"]), attendanceService: service })).post(`/api/v1/attendance/${attendanceId}/corrections`).set("Authorization", "Bearer token").send({ status: "unknown", reason: "x" }).expect(422);
    expect(service.correct).not.toHaveBeenCalled();
  });
});
