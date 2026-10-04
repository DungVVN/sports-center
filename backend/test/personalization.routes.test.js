import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { personalizationOperations } from "../src/modules/training/index.js";

const uuid = "11111111-1111-4111-8111-111111111111";
describe("personalization HTTP permissions and validation", () => {
  it.each(personalizationOperations)("protects %s %s with %s", async (method, path, permission, operation) => {
    const service = { [operation]: vi.fn() };
    const authService = { getAuthentication: async () => ({ user: { id: uuid, role: "member" }, permissions: [] }) };
    const app = createApp({ authService, personalizationService: service });
    await request(app)[method](`/api/v1${path.replace(":id", uuid)}`).expect(401);
    await request(app)[method](`/api/v1${path.replace(":id", uuid)}`).set("Authorization", "Bearer fixture").send({}).expect(403);
    expect(service[operation]).not.toHaveBeenCalled();
    expect(permission).toMatch(/^training\./);
  });
  it("requires explicit consent acknowledgment, then delegates only authenticated identity", async () => {
    const actor = { id: uuid, role: "member" };
    const service = { consent: vi.fn().mockResolvedValue({ id: uuid }) };
    const app = createApp({ personalizationService: service, authService: { getAuthentication: async () => ({ user: actor, permissions: ["training.self.manage"] }) } });
    const path = "/api/v1/members/me/training-consents";
    await request(app).post(path).set("Authorization", "Bearer fixture").send({ purpose: "assessment", policyVersion: "training-privacy-v1", acknowledged: false }).expect(422);
    const body = { purpose: "assessment", policyVersion: "training-privacy-v1", acknowledged: true };
    await request(app).post(path).set("Authorization", "Bearer fixture").send(body).expect(201);
    expect(service.consent).toHaveBeenCalledWith(body, actor);
  });
});
