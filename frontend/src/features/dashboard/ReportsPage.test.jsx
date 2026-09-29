import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportsPage } from "./ReportsPage.jsx";
import { dashboardApi } from "./dashboard-api.js";
import { classApi } from "../classes/index.js";

vi.mock("./dashboard-api.js", () => ({ dashboardApi: { revenue: vi.fn(), attendance: vi.fn(), exportCsv: vi.fn() } }));
vi.mock("../classes/index.js", () => ({ classApi: { coaches: vi.fn() } }));

describe("ReportsPage custom date range", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classApi.coaches.mockResolvedValue([]);
    dashboardApi.revenue.mockResolvedValue({ from: "2026-09-01", to: "2026-09-29", paid: 0, payments: 0, pending: 0, pendingPayments: 0, transactionValue: 0, completionRate: 0, byStatus: [], trend: [] });
    dashboardApi.attendance.mockResolvedValue({ summary: { total: 0, attended: 0, absent: 0, notMarked: 0, attendanceRate: 0 }, byStatus: [], trend: [] });
  });

  it("blocks reversed dates before requesting reports or exporting CSV", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ReportsPage /></QueryClientProvider>);
    await waitFor(() => expect(dashboardApi.revenue).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Tùy chọn" }));
    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2026-09-30" } });
    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2026-09-29" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
    expect(screen.getByRole("button", { name: "Tải CSV doanh thu" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tải CSV điểm danh" })).toBeDisabled();
    expect(dashboardApi.revenue.mock.calls.some(([query]) => query.period === "custom")).toBe(false);
  });
});
