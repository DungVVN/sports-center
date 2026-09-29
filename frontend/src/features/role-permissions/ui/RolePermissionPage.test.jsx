import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RolePermissionPage } from "./RolePermissionPage.jsx";
import { rolePermissionApi } from "../api/role-permission-api.js";

vi.mock("../api/role-permission-api.js", () => ({ rolePermissionApi: { matrix: vi.fn(), replace: vi.fn() } }));

const matrix = {
  permissions: [{ code: "payment.read", description: "Xem thanh toán", group: "payment" }],
  roles: [
    { code: "manager", label: "Quản lý", version: 2, permissionCodes: [] },
    { code: "receptionist", label: "Lễ tân", version: 0, permissionCodes: [] },
    { code: "coach", label: "Huấn luyện viên", version: 0, permissionCodes: [] },
    { code: "member", label: "Hội viên", version: 0, permissionCodes: [] },
  ],
};
function renderPage() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><RolePermissionPage /></QueryClientProvider>); }

describe("Admin role permission matrix", () => {
  afterEach(cleanup);
  beforeEach(() => {
    rolePermissionApi.matrix.mockReset().mockResolvedValue(matrix);
    rolePermissionApi.replace.mockReset().mockResolvedValue({ role: "manager", version: 3, permissionCodes: ["payment.read"] });
  });

  it("saves a checked permission with the role's current version", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Xem thanh toán — manager" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(rolePermissionApi.replace).toHaveBeenCalledWith("manager", { version: 2, permissionCodes: ["payment.read"] }));
  });

  it("shows a stale-edit conflict without claiming success", async () => {
    rolePermissionApi.replace.mockRejectedValue({ status: 409, message: "Conflict" });
    renderPage();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Xem thanh toán — manager" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("tải lại");
  });

  it("selects role-specific dependencies and disables inapplicable functions", async () => {
    rolePermissionApi.matrix.mockResolvedValueOnce({ ...matrix, permissions: [
      { code: "class.read", description: "Xem lớp", group: "class", requires: [] },
      { code: "booking.read", description: "Xem booking", group: "booking", requires: ["class.read"] },
      { code: "booking.write", description: "Tạo booking", group: "booking", requires: ["booking.read"], requiresByRole: { manager: ["member.read"] } },
      { code: "member.read", description: "Xem hội viên", group: "member", requires: [] },
      { code: "support.ticket.create", description: "Tạo hỗ trợ", group: "support", requires: [], availableRoles: ["member"] },
    ] });
    renderPage();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Tạo booking — manager" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(rolePermissionApi.replace).toHaveBeenCalledWith("manager", {
      version: 2, permissionCodes: expect.arrayContaining(["booking.write", "booking.read", "class.read", "member.read"]),
    }));
    expect(screen.getByRole("checkbox", { name: "Tạo hỗ trợ — manager" })).toBeDisabled();
  });
});
