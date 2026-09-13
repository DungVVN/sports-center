import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const memberId = "11111111-1111-4111-8111-111111111111";
const templateId = "22222222-2222-4222-8222-222222222222";
function authService(permissions) { return { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "coach-1", role: "coach" }, permissions }) }; }
function trainingService() { return { members: vi.fn().mockResolvedValue([]), templates: vi.fn().mockResolvedValue([]), plans: vi.fn().mockResolvedValue([]), createPlan: vi.fn().mockResolvedValue({ id: "plan-1" }) }; }

describe("Training routes", () => {
  it("creates a shared template with its first exercise", async () => {
    const service = { ...trainingService(), createTemplate: vi.fn().mockResolvedValue({ id: "template-1" }) };
    const body = { name: "Sức bền cơ bản", targetGroup: "Người mới", exercises: [{ name: "Squat", sets: 3, reps: 10, rest_seconds: 60 }] };
    await request(createApp({ authService: authService(["training.write"]), trainingService: service })).post("/api/v1/training-templates").set("Authorization", "Bearer token").send(body).expect(403);
    await request(createApp({ authService: authService(["training.template.manage"]), trainingService: service })).post("/api/v1/training-templates").set("Authorization", "Bearer token").send(body).expect(201);
    expect(service.createTemplate).toHaveBeenCalledWith(expect.objectContaining({ name: "Sức bền cơ bản" }), "coach-1");
  });
  it("returns only members the authenticated Coach may train", async () => {
    const service = trainingService();
    await request(createApp({ authService: authService(["training.write"]), trainingService: service })).get("/api/v1/training-members").set("Authorization", "Bearer token").expect(200);
    expect(service.members).toHaveBeenCalledWith({ id: "coach-1", role: "coach" });
  });

  it("creates a plan using a selected member and template", async () => {
    const service = trainingService();
    await request(createApp({ authService: authService(["training.write"]), trainingService: service })).post("/api/v1/training-plans").set("Authorization", "Bearer token").send({ memberId, templateId, name: "Tăng sức bền", goal: "Tập đều 3 buổi", startsOn: "2026-09-14", endsOn: "2026-10-14" }).expect(201);
    expect(service.createPlan).toHaveBeenCalledWith(expect.objectContaining({ memberId, templateId }), { id: "coach-1", role: "coach" });
  });

  it("blocks unpermitted users before exposing training members", async () => {
    const service = trainingService();
    await request(createApp({ authService: authService([]), trainingService: service })).get("/api/v1/training-members").set("Authorization", "Bearer token").expect(403);
    expect(service.members).not.toHaveBeenCalled();
  });
});
