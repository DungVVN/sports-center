import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/api-error.js";
import { staffApi } from "./staff-api.js";
import { StaffPage } from "./StaffPage.jsx";

vi.mock("./staff-api.js", () => ({ staffApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), setStatus: vi.fn(), resetPassword: vi.fn() } }));

function renderPage(session) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><StaffPage session={session} /></QueryClientProvider>);
}

describe("StaffPage", () => {
  beforeEach(() => { vi.clearAllMocks(); staffApi.list.mockResolvedValue([]); });
  afterEach(cleanup);

  it("shows the empty staff state", async () => {
    renderPage();
    expect(await screen.findByText("Chưa có nhân viên.")).toBeInTheDocument();
  });

  it("shows the reset action only to Admin", async () => {
    staffApi.list.mockResolvedValue([{ id: "staff-1", employeeCode: "STF-1", fullName: "Lan", email: "lan@example.test", role: "coach", status: "active" }]);
    renderPage({ user: { role: "manager" } });
    expect(await screen.findByText("STF-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cấp lại MK" })).not.toBeInTheDocument();
  });

  it("lets Admin confirm a one-time staff credential reset", async () => {
    staffApi.list.mockResolvedValue([{ id: "staff-1", employeeCode: "STF-1", fullName: "Lan", email: "lan@example.test", role: "coach", status: "active" }]);
    staffApi.resetPassword.mockResolvedValue({ credentialEmailDelivered: false, temporaryPassword: "Temp-QA-123" });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      renderPage({ user: { role: "admin" } });
      expect(await screen.findByText("STF-1")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Cấp lại MK" }));
      await waitFor(() => expect(staffApi.resetPassword).toHaveBeenCalledWith("staff-1"));
      expect(await screen.findByText("Temp-QA-123")).toBeInTheDocument();
    } finally {
      confirm.mockRestore();
    }
  });

  it("creates staff and renders the one-time temporary password", async () => {
    staffApi.create.mockResolvedValue({ staff: { id: "staff-1" }, temporaryPassword: "Temp-123", credentialEmailDelivered: true });
    renderPage();
    await screen.findByText("Chưa có nhân viên.");
    fireEvent.change(screen.getByLabelText("Họ tên"), { target: { value: "Lan" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lan@example.test" } });
    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "0901234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo nhân viên" }));
    await waitFor(() => expect(staffApi.create).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Lan", email: "lan@example.test", phone: "0901234567", role: "receptionist" })));
    expect(await screen.findByText("Temp-123")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("auth-success");
  });

  it("shows an API 409 conflict without clearing the staff form", async () => {
    staffApi.create.mockRejectedValue(new ApiError({ status: 409, message: "Email nhân viên đã tồn tại." }));
    renderPage();
    await screen.findByText("Chưa có nhân viên.");
    fireEvent.change(screen.getByLabelText("Họ tên"), { target: { value: "Lan" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lan@example.test" } });
    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "0901234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo nhân viên" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email nhân viên đã tồn tại.");
    expect(screen.getByLabelText("Họ tên")).toHaveValue("Lan");
    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "0901234568" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("blocks a too-short phone before requesting staff creation", async () => {
    renderPage();
    await screen.findByText("Chưa có nhân viên.");
    fireEvent.change(screen.getByLabelText("Họ tên"), { target: { value: "Lan" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lan@example.test" } });
    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo nhân viên" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Số điện thoại phải từ 9 đến 20 ký tự.");
    expect(screen.getByLabelText("Số điện thoại")).toHaveFocus();
    expect(screen.getByLabelText("Số điện thoại")).toHaveAttribute("aria-invalid", "true");
    expect(staffApi.create).not.toHaveBeenCalled();
  });

  it("blocks a too-short phone before updating an existing staff member", async () => {
    const staff = { id: "staff-1", employeeCode: "STF-001", fullName: "Lan", email: "lan@example.test", phone: "0901234567", role: "coach", status: "active", specialties: [] };
    staffApi.list.mockResolvedValue([staff]);
    staffApi.get.mockResolvedValue(staff);
    renderPage();
    const row = await screen.findByRole("row", { name: /STF-001 Lan/ });
    fireEvent.click(row.querySelector("button"));
    const dialog = await screen.findByRole("dialog", { name: "Cập nhật nhân viên" });
    fireEvent.change(await within(dialog).findByRole("textbox", { name: "Số điện thoại" }), { target: { value: "123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Số điện thoại phải từ 9 đến 20 ký tự.");
    expect(staffApi.update).not.toHaveBeenCalled();
  });
});
