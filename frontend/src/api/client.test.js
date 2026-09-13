import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-error.js";
import { apiClient } from "./client.js";
import { apiBaseUrl } from "../config/runtime.js";

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
});
