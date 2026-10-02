import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createAuditRouter } from "../src/modules/audit/presentation/audit.routes.js";

function appFor(role, permissions, service) {
  const auth = { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "actor", role }, permissions }) };
  const app = express();
  app.use(createAuditRouter(service, auth));
  app.use((error, _req, res, next) => {
    void next;
    res.status(error.statusCode ?? 500).json({ code: error.code });
  });
  return app;
}

describe("record history route", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("lets Admin read scoped history without role assignments", async () => {
    const service = { list: vi.fn().mockResolvedValue({ items: [] }) };
    await request(appFor("admin", [], service)).get(`/audit-logs?entityType=booking&entityId=${id}`).set("Authorization", "Bearer token").expect(200);
    expect(service.list).toHaveBeenCalledWith({ page: 1, pageSize: 20, entityType: "booking", entityId: id });
  });
  it("rejects a partial scope without exposing the full history", async () => {
    const service = { list: vi.fn() };
    await request(appFor("admin", [], service)).get("/audit-logs?entityType=booking").set("Authorization", "Bearer token").expect(422);
    expect(service.list).not.toHaveBeenCalled();
  });
  it("still denies staff without audit.read", async () => {
    const service = { list: vi.fn() };
    await request(appFor("receptionist", ["payment.read"], service)).get(`/audit-logs?entityType=payment&entityId=${id}`).set("Authorization", "Bearer token").expect(403);
    expect(service.list).not.toHaveBeenCalled();
  });
});
