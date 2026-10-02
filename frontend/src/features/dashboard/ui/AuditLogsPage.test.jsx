import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dashboardApi } from "../api/dashboard-api.js";
import { AuditLogsPage } from "./AuditLogsPage.jsx";

vi.mock("../api/dashboard-api.js", () => ({ dashboardApi: { auditLogs: vi.fn() } }));
afterEach(cleanup);

describe("audit log display", () => {
  it("shows one activity line and a readable target while keeping the ID in its tooltip", async () => {
    dashboardApi.auditLogs.mockResolvedValue({ items: [{ id: "log-1", actor: { id: "actor-1", name: "Quản trị hệ thống" }, action: "auth.login_succeeded", summary: "Đăng nhập thành công.", entity_id: "session-id", entity: { label: "Phiên đăng nhập", value: "Quản trị hệ thống" } }], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AuditLogsPage /></QueryClientProvider>);
    const row = (await screen.findByText("Đăng nhập thành công")).closest("tr");
    const cells = within(row).getAllByRole("cell");
    expect(screen.getByRole("columnheader", { name: "Tên người thao tác" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Mã người thao tác" })).not.toBeInTheDocument();
    expect(cells).toHaveLength(6);
    expect(cells[1]).toHaveTextContent(/^Quản trị hệ thống$/);
    expect(cells[1]).not.toHaveTextContent("actor-1");
    expect(cells[3]).toHaveTextContent(/^Đăng nhập thành công$/);
    expect(cells[3].querySelector("small")).toBeNull();
    expect(cells[4]).toHaveTextContent("Phiên đăng nhậpQuản trị hệ thống");
    expect(cells[4]).not.toHaveTextContent("session-id");
    expect(within(cells[4]).getByTitle("session-id")).toBeInTheDocument();
  });
});
