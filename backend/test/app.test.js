import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("HTTP foundation", () => {
  it("prevents caching even when authentication fails outside the auth router", async () => {
    const response = await request(app).get("/api/v1/members").expect(401);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it.each([
    { body: '{"password":"private-value",', status: 400, code: "INVALID_JSON" },
    { body: JSON.stringify({ password: "x".repeat(1024 * 1024) }), status: 413, code: "PAYLOAD_TOO_LARGE" },
  ])("normalizes request body failures as $status with a request id", async ({ body, status, code }) => {
    const response = await request(app).post("/api/v1/auth/login")
      .set("Content-Type", "application/json").send(body).expect(status);
    expect(response.body.error.code).toBe(code);
    expect(response.body.error.requestId).toBe(response.headers["x-request-id"]);
    expect(response.body.error.requestId).toBeTruthy();
    expect(JSON.stringify(response.body)).not.toContain("private-value");
  });

  it.each([
    { header: "Content-Encoding", value: "unsupported", code: "UNSUPPORTED_ENCODING" },
    { header: "Content-Type", value: "application/json; charset=unsupported", code: "UNSUPPORTED_CHARSET" },
  ])("rejects unsupported request body format $code", async ({ header, value, code }) => {
    const response = await request(app).post("/api/v1/auth/login")
      .set("Content-Type", "application/json").set(header, value).send('{}').expect(415);
    expect(response.body.error.code).toBe(code);
    expect(response.body.error.requestId).toBeTruthy();
  });

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
