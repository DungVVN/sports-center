import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

describe("operational readiness", () => {
  it("separates database readiness from process liveness", async () => {
    const readinessCheck = vi.fn().mockRejectedValue(new Error("private database connection details"));
    const app = createApp({ readinessCheck });
    await request(app).get("/api/v1/health").expect(200);
    expect(readinessCheck).not.toHaveBeenCalled();
    const response = await request(app).get("/api/v1/ready").expect(503);
    expect(response.body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(JSON.stringify(response.body)).not.toContain("private database");
  });
  it("reports ready only after the dependency check resolves", async () => {
    const readinessCheck = vi.fn().mockResolvedValue(undefined);
    const response = await request(createApp({ readinessCheck })).get("/api/v1/ready").expect(200);
    expect(response.body.data.status).toBe("ready");
    expect(readinessCheck).toHaveBeenCalledOnce();
  });
});
