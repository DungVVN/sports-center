import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("HTTP foundation", () => {
  it("returns the API health response with a request id", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("returns a normalized not-found error", async () => {
    const response = await request(app).get("/api/v1/does-not-exist").expect(404);

    expect(response.body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
    expect(response.body.error.requestId).toBeTruthy();
  });

  it("publishes the OpenAPI base document", async () => {
    const response = await request(app).get("/openapi.json").expect(200);

    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.paths["/health"]).toBeTruthy();
    expect(response.body.paths["/reports/{type}/export"]).toBeTruthy();
    expect(response.body.paths["/ai-assist/deliveries"]).toBeTruthy();
  });

  it("rejects state-changing requests from an untrusted browser origin", async () => {
    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", "https://untrusted.example")
      .expect(403);

    expect(response.body.error.code).toBe("UNTRUSTED_ORIGIN");
  });
});
