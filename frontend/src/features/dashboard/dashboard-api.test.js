import { afterEach, describe, expect, it, vi } from "vitest";
import { dashboardApi } from "./dashboard-api.js";
import { errorMessageFor } from "../../shared/api/error-message.js";

afterEach(() => vi.unstubAllGlobals());

describe("dashboardApi.exportCsv", () => {
  it("preserves the business reason returned by the backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: { code: "INVALID_DATE_RANGE", message: "Ngày kết thúc phải sau ngày bắt đầu.", requestId: "csv-1" },
    }), { status: 422, headers: { "content-type": "application/json" } })));

    const error = await dashboardApi.exportCsv("revenue", { period: "custom" }).catch((caught) => caught);
    expect(errorMessageFor(error, "Không thể tải báo cáo doanh thu.")).toBe("Ngày kết thúc phải sau ngày bắt đầu.");
  });

  it("explains an unstructured server response and includes its request ID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Gateway error", { status: 502, headers: { "x-request-id": "csv-2" } })));

    const error = await dashboardApi.exportCsv("attendance", { period: "month" }).catch((caught) => caught);
    const message = errorMessageFor(error, "Không thể tải báo cáo điểm danh.");
    expect(message).toContain("Không thể tải báo cáo điểm danh: máy chủ chưa cung cấp nguyên nhân cụ thể.");
    expect(message).toContain("Mã tra cứu: csv-2");
    expect(message).not.toContain("502");
  });
});
