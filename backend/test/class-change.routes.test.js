import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

function authService(permissions) { return { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "receptionist-1", role: "receptionist" }, permissions }) }; }
function classService() { return { changes: vi.fn().mockResolvedValue([]), list: vi.fn().mockResolvedValue([]), rooms: vi.fn().mockResolvedValue([]), coaches: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), publish: vi.fn(), requestChange: vi.fn(), reviewChange: vi.fn() }; }

describe("Class change review routes", () => {
  it("returns pending requests to a reviewer", async () => { const service = classService(); await request(createApp({ authService: authService(["class.change.review"]), classService: service })).get("/api/v1/class-change-requests?status=pending").set("Authorization", "Bearer token").expect(200); expect(service.changes).toHaveBeenCalledWith("pending"); });
  it("does not reveal requests without review permission", async () => { const service = classService(); await request(createApp({ authService: authService([]), classService: service })).get("/api/v1/class-change-requests").set("Authorization", "Bearer token").expect(403); expect(service.changes).not.toHaveBeenCalled(); });
});
