import { afterEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../src/shared/middleware/error-handler.js";

function respond(error) {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  errorHandler(error, { id: "db-test-request" }, response, vi.fn());
  return response;
}

describe("database availability errors", () => {
  afterEach(() => vi.restoreAllMocks());
  it("logs only safe correlation metadata for unexpected failures", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("password=private-password postgresql://user:private-secret@host/db"), {
      body: { token: "private-token", email: "private@example.com" },
    });
    const response = respond(error);
    expect(log).toHaveBeenCalledExactlyOnceWith({
      event: "request_failed", statusCode: 500, code: "INTERNAL_ERROR", requestId: "db-test-request",
    });
    expect(JSON.stringify(response.json.mock.calls)).not.toContain("private-");
  });
  it.each(["ETIMEDOUT", "ECONNRESET", "P1001", "P1002", "P1008", "P1017", "P2024"])("returns a retryable 503 for Prisma %s", (code) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = respond(Object.assign(new Error("private database details"), { name: "PrismaClientKnownRequestError", code }));
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({ success: false, error: {
      code: "DATABASE_UNAVAILABLE", message: "Kết nối dữ liệu tạm thời gián đoạn. Vui lòng thử lại sau ít phút.", requestId: "db-test-request",
    } });
  });
  it.each([
    { name: "Error", code: "ETIMEDOUT" },
    { name: "PrismaClientKnownRequestError", code: "P2002" },
  ])("does not classify unrelated network or integrity failures as DB outages", (metadata) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = respond(Object.assign(new Error("failure"), metadata));
    expect(response.status).toHaveBeenCalledWith(500);
  });
  it("recognizes initialization errorCode", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(respond({ name: "PrismaClientInitializationError", errorCode: "P1001" }).status).toHaveBeenCalledWith(503);
  });
  it.each(["Connection terminated due to connection timeout", "timeout exceeded when trying to connect"])("recognizes pg-pool timeout: %s", (message) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(respond(new Error(message)).status).toHaveBeenCalledWith(503);
  });
});
