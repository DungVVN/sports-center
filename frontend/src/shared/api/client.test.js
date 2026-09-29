import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-error.js";
import { apiClient } from "./client.js";
import { apiBaseUrl } from "../../config/runtime.js";
import { errorMessageFor } from "./error-message.js";

afterEach(() => vi.unstubAllGlobals());

describe("apiClient", () => {
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
