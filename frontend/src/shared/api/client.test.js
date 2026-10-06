import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-error.js";
import { apiClient, mutationSucceededEvent } from "./client.js";
import { apiBaseUrl } from "../../config/runtime.js";
import { errorMessageFor } from "./error-message.js";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("apiClient", () => {
  it.each([
    { code: "FORBIDDEN", expected: 1 },
    { code: "PASSWORD_CHANGE_REQUIRED", expected: 1 },
    { code: "UNTRUSTED_ORIGIN", expected: 0 },
    { code: "BOOKING_ACCESS_DENIED", expected: 0 },
  ])("refreshes permissions only for relevant 403 errors ($code)", async ({ code, expected }) => {
    const listener = vi.fn();
    window.addEventListener("sports-center:permissions-changed", listener);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code } }), { status: 403, headers: { "content-type": "application/json" } })));
    try {
      await expect(apiClient.get("/classes")).rejects.toMatchObject({ code });
      expect(listener).toHaveBeenCalledTimes(expected);
    } finally { window.removeEventListener("sports-center:permissions-changed", listener); }
  });

  it("refreshes notifications for successful writes but not reads or marking notifications read", async () => {
    const listener = vi.fn();
    window.addEventListener(mutationSucceededEvent, listener);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify({ success: true, data: {} }), { status: 200, headers: { "content-type": "application/json" } })));
    try {
      await apiClient.post("/courses", {});
      expect(listener).toHaveBeenCalledTimes(1);
      await apiClient.get("/notifications");
      await apiClient.patch("/notifications/id/read", {});
      expect(listener).toHaveBeenCalledTimes(1);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 422, headers: { "content-type": "application/json" } })));
      await expect(apiClient.post("/courses", {})).rejects.toBeInstanceOf(ApiError);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally { window.removeEventListener(mutationSucceededEvent, listener); }
  });
  it("ends a stalled request with a retryable timeout message", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));
    const result = apiClient.get("/classes", { timeoutMs: 100 }).catch((error) => error);
    await vi.advanceTimersByTimeAsync(100);
    const error = await result;
    expect(error).toMatchObject({ code: "REQUEST_TIMEOUT" });
    expect(errorMessageFor(error, "Không thể tải lớp học.")).toContain("Máy chủ phản hồi quá lâu");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves caller cancellation and removes its timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));
    const controller = new AbortController();
    const result = apiClient.get("/classes", { signal: controller.signal }).catch((error) => error);
    controller.abort();
    expect(await result).toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("also times out when headers arrive but the response body stalls", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_url, { signal }) => ({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
    })));
    const result = apiClient.get("/classes", { timeoutMs: 100 }).catch((error) => error);
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toMatchObject({ code: "REQUEST_TIMEOUT" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns the data envelope from a successful API response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { status: "ok" } }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiClient.get("/health")).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(`${apiBaseUrl}/health`, expect.objectContaining({ credentials: "include", method: "GET" }));
  });

  it("maps the backend error envelope to ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ." } }), { status: 422, headers: { "content-type": "application/json" } })));
    await expect(apiClient.get("/members")).rejects.toMatchObject({ name: ApiError.name, code: "VALIDATION_ERROR", status: 422 });
  });

  it("shows the backend request ID for a server error without exposing internal details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", requestId: "request-123" } }), { status: 500, headers: { "content-type": "application/json" } })));
    const error = await apiClient.get("/dashboards/manager").catch((caught) => caught);
    expect(error.requestId).toBe("request-123");
    expect(errorMessageFor(error)).toContain("Mã tra cứu: request-123");
  });

  it("identifies an HTTP response that is not the expected API JSON envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad Gateway", { status: 502, headers: { "content-type": "text/plain", "x-request-id": "proxy-1" } })));
    const error = await apiClient.get("/membership-packages").catch((caught) => caught);
    expect(error).toMatchObject({ status: 502, code: "REQUEST_FAILED", requestId: "proxy-1", message: "Máy chủ không cung cấp thông báo lỗi hợp lệ." });
    expect(errorMessageFor(error, "Không thể tải danh sách gói tập.")).toContain("Không thể tải danh sách gói tập: máy chủ chưa cung cấp nguyên nhân cụ thể.");
    expect(errorMessageFor(error, "Không thể tải danh sách gói tập.")).not.toContain("502");
  });

  it("notifies the application when the server rejects an expired session", async () => {
    const onAuthenticationExpired = vi.fn();
    window.addEventListener("sports-center:authentication-expired", onAuthenticationExpired);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: "UNAUTHENTICATED", message: "Bạn cần đăng nhập để tiếp tục." } }), { status: 401, headers: { "content-type": "application/json" } })));

    await expect(apiClient.get("/dashboards/manager")).rejects.toMatchObject({ status: 401 });
    expect(onAuthenticationExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener("sports-center:authentication-expired", onAuthenticationExpired);
  });
});
