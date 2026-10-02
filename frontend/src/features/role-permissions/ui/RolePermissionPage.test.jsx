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
function renderPage() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return { ...render(<QueryClientProvider client={client}><RolePermissionPage /></QueryClientProvider>), client }; }

describe("Admin role permission matrix", () => {
  it("shows service permissions with role restrictions and selects refund dependencies", async () => {
    rolePermissionApi.matrix.mockResolvedValueOnce({ ...matrix, permissions: [
      { code: "course.read", description: "Xem khóa", group: "course", requires: [] },
      { code: "course.manage", description: "Quản lý khóa", group: "course", requires: ["course.read"], availableRoles: ["receptionist"] },
      { code: "pt.read", description: "Xem PT", group: "pt", requires: [] },
      { code: "pt.complete", description: "Chốt buổi PT", group: "pt", requires: ["pt.read"], availableRoles: ["coach"] },
      { code: "payment.read", description: "Xem thanh toán", group: "payment", requires: [] },
      { code: "payment.refund.read", description: "Xem hoàn tiền", group: "payment", requires: [] },
      { code: "payment.refund.review", description: "Duyệt hoàn tiền", group: "payment", requires: ["payment.read", "payment.refund.read"], availableRoles: ["manager"] },
    ] });
    renderPage();
    const manage = await screen.findByRole("checkbox", { name: "Quản lý khóa — manager" });
    expect(manage).toBeDisabled();
    expect(manage).toHaveAttribute("title", "Quyền này chỉ áp dụng cho: Lễ tân.");
    expect(screen.getByText("Khóa có hướng dẫn")).toBeInTheDocument();
    expect(screen.getByText("Huấn luyện cá nhân")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Chốt buổi PT — coach" })).not.toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Chốt buổi PT — member" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Duyệt hoàn tiền — manager" }));
    expect(screen.getByRole("checkbox", { name: "Xem thanh toán — manager" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Xem hoàn tiền — manager" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(rolePermissionApi.replace).toHaveBeenCalledWith("manager", { version: 2, permissionCodes: expect.arrayContaining(["payment.refund.review", "payment.refund.read", "payment.read"]) }));
  });

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

  it("discards old edits after an explicit successful reload", async () => {
    renderPage();
    const checkbox = await screen.findByRole("checkbox", { name: "Xem thanh toán — manager" });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    rolePermissionApi.matrix.mockResolvedValue({ ...matrix, roles: matrix.roles.map((role) => ({ ...role, version: role.version + 1 })) });
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
  });

  it("keeps the original draft version after a background refresh", async () => {
    const { client } = renderPage();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Xem thanh toán — manager" }));
    rolePermissionApi.matrix.mockResolvedValue({ ...matrix, roles: matrix.roles.map((role) => ({ ...role, version: role.version + 1 })) });
    await client.refetchQueries({ queryKey: ["role-permissions"] });
    await waitFor(() => expect(screen.getByRole("button", { name: "Lưu thay đổi" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(rolePermissionApi.replace).toHaveBeenCalledWith("manager", { version: 2, permissionCodes: ["payment.read"] }));
  });

  it("retains unsaved edits when reload fails", async () => {
    renderPage();
    const checkbox = await screen.findByRole("checkbox", { name: "Xem thanh toán — manager" });
    fireEvent.click(checkbox);
    rolePermissionApi.matrix.mockRejectedValue(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
    expect(checkbox).toBeChecked();
  });

  it("keeps committed roles in cache when a later role fails", async () => {
    rolePermissionApi.replace.mockResolvedValueOnce({ version: 3, permissionCodes: ["payment.read"] }).mockRejectedValueOnce({ status: 409 });
    renderPage();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Xem thanh toán — manager" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Xem thanh toán — receptionist" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await screen.findByRole("alert");
    rolePermissionApi.replace.mockResolvedValue({ version: 1, permissionCodes: ["payment.read"] });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(rolePermissionApi.replace).toHaveBeenCalledTimes(3));
    expect(rolePermissionApi.replace.mock.calls[2][0]).toBe("receptionist");
  });

  it("keeps member cancellation tied to own reservations instead of staff-wide access", async () => {
    rolePermissionApi.matrix.mockResolvedValueOnce({ ...matrix, permissions: [
      { code: "facility.booking.read", description: "Xem mọi đơn", group: "facility", requires: [], availableRoles: ["manager", "receptionist", "coach"] },
      { code: "facility.booking.self.read", description: "Xem đơn của mình", group: "facility", requires: [] },
      { code: "facility.booking.cancel", description: "Hủy đơn", group: "facility", requires: [], requiresByRole: { member: ["facility.booking.self.read"], manager: ["facility.booking.read"] } },
    ] });
    renderPage();
    const cancel = await screen.findByRole("checkbox", { name: "Hủy đơn — member" });
    fireEvent.click(cancel);
    expect(cancel).toBeChecked();
    const own = screen.getByRole("checkbox", { name: "Xem đơn của mình — member" });
    expect(own).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Xem mọi đơn — member" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(rolePermissionApi.replace).toHaveBeenCalledWith("member", { version: 0, permissionCodes: ["facility.booking.cancel", "facility.booking.self.read"] }));
    fireEvent.click(own);
    expect(cancel).not.toBeChecked();
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
