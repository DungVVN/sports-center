import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/api-error.js";
import { staffApi } from "./staff-api.js";
import { StaffPage } from "./StaffPage.jsx";

vi.mock("./staff-api.js", () => ({ staffApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), setStatus: vi.fn() } }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><StaffPage /></QueryClientProvider>);
}

describe("StaffPage", () => {
  beforeEach(() => { vi.clearAllMocks(); staffApi.list.mockResolvedValue([]); });
  afterEach(cleanup);

  it("shows the empty staff state", async () => {
    renderPage();
    expect(await screen.findByText("Chưa có nhân viên.")).toBeInTheDocument();
  });

  it("creates staff and renders the one-time temporary password", async () => {
    staffApi.create.mockResolvedValue({ staff: { id: "staff-1" }, temporaryPassword: "Temp-123", credentialEmailDelivered: true });
    renderPage();
    await screen.findByText("Chưa có nhân viên.");
    fireEvent.change(screen.getByLabelText("Họ tên"), { target: { value: "Lan" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lan@example.test" } });
    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "0901" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo nhân viên" }));
    await waitFor(() => expect(staffApi.create).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Lan", email: "lan@example.test", phone: "0901", role: "receptionist" })));
    expect(await screen.findByText("Temp-123")).toBeInTheDocument();
  });

  it("shows an API 409 conflict without clearing the staff form", async () => {
    staffApi.create.mockRejectedValue(new ApiError({ status: 409, message: "Email nhân viên đã tồn tại." }));
    renderPage();
    await screen.findByText("Chưa có nhân viên.");
    fireEvent.change(screen.getByLabelText("Họ tên"), { target: { value: "Lan" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lan@example.test" } });
    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "0901" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo nhân viên" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email nhân viên đã tồn tại.");
    expect(screen.getByLabelText("Họ tên")).toHaveValue("Lan");
  });
});
