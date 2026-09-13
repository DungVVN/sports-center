import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const memberId = "11111111-1111-4111-8111-111111111111";
const coachUserId = "22222222-2222-4222-8222-222222222222";
const assignment = { id: "33333333-3333-4333-8333-333333333333", member_id: memberId, coach_user_id: coachUserId };

function authService(permissions) {
  return { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "44444444-4444-4444-8444-444444444444", role: "receptionist" }, permissions }) };
}

function assignmentService() {
  return { list: vi.fn().mockResolvedValue([assignment]), assign: vi.fn().mockResolvedValue(assignment) };
}

describe("Coach assignment routes", () => {
  it("returns assignment history for a permitted receptionist", async () => {
    const service = assignmentService();
    const response = await request(createApp({ authService: authService(["member.write"]), assignmentService: service }))
      .get(`/api/v1/members/${memberId}/coach-assignments`).set("Authorization", "Bearer token").expect(200);

    expect(response.body.data).toEqual([assignment]);
    expect(service.list).toHaveBeenCalledWith(memberId);
  });

  it("creates an effective-dated assignment and passes actor identity", async () => {
    const service = assignmentService();
    await request(createApp({ authService: authService(["member.write"]), assignmentService: service }))
      .post(`/api/v1/members/${memberId}/coach-assignments`).set("Authorization", "Bearer token")
      .send({ coachUserId, effectiveFrom: "2026-09-14", reason: "Điều chỉnh lịch tập" }).expect(201);

    expect(service.assign).toHaveBeenCalledWith(memberId, { coachUserId, effectiveFrom: "2026-09-14", reason: "Điều chỉnh lịch tập" }, "44444444-4444-4444-8444-444444444444");
  });

  it("rejects users without member.write before calling the service", async () => {
    const service = assignmentService();
    await request(createApp({ authService: authService([]), assignmentService: service }))
      .get(`/api/v1/members/${memberId}/coach-assignments`).set("Authorization", "Bearer token").expect(403);

    expect(service.list).not.toHaveBeenCalled();
  });

  it("validates the effective date", async () => {
    const service = assignmentService();
    await request(createApp({ authService: authService(["member.write"]), assignmentService: service }))
      .post(`/api/v1/members/${memberId}/coach-assignments`).set("Authorization", "Bearer token")
      .send({ coachUserId, effectiveFrom: "tomorrow" }).expect(422);

    expect(service.assign).not.toHaveBeenCalled();
  });
});
