import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/api-error.js";
import { classApi } from "../classes/class-api.js";
import { memberApi } from "./member-api.js";
import { MembersPage } from "./MembersPage.jsx";

vi.mock("../classes/class-api.js", () => ({ classApi: { coaches: vi.fn() } }));
vi.mock("./member-api.js", () => ({ memberApi: { list: vi.fn(), create: vi.fn(), get: vi.fn(), update: vi.fn(), replaceContacts: vi.fn(), coachAssignments: vi.fn(), assignCoach: vi.fn() } }));

function renderPage(props) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MembersPage {...props} /></QueryClientProvider>);
}

describe("MembersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memberApi.list.mockResolvedValue([]);
    classApi.coaches.mockResolvedValue([]);
  });
  afterEach(cleanup);

  it("shows the empty state after the members query resolves", async () => {
    renderPage();
    expect(await screen.findByText("Chưa có hội viên.")).toBeInTheDocument();
  });

  it("keeps member creation and row actions unavailable in read-only mode", async () => {
    memberApi.list.mockResolvedValue([{ id: "member-1", memberCode: "HV-01", fullName: "An", phone: "0900" }]);
    renderPage({ readOnly: true });
    expect(await screen.findByText("An")).toBeInTheDocument();
    expect(screen.queryByText("Thêm hội viên")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
  });

  it("creates a member and shows the standardized success feedback", async () => {
    memberApi.create.mockResolvedValue({ id: "member-2" });
    renderPage();
    await screen.findByText("Chưa có hội viên.");
    fireEvent.change(screen.getByLabelText("Họ tên"), { target: { value: "Bình" } });
    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "0901" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo hội viên" }));
    await waitFor(() => expect(memberApi.create).toHaveBeenCalledWith({ fullName: "Bình", email: "", phone: "0901" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã tạo hồ sơ hội viên.");
  });

  it("shows an API 409 message without discarding the form", async () => {
    memberApi.create.mockRejectedValue(new ApiError({ status: 409, message: "Email đã tồn tại." }));
    renderPage();
    await screen.findByText("Chưa có hội viên.");
    fireEvent.change(screen.getByLabelText("Họ tên"), { target: { value: "Bình" } });
    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "0901" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo hội viên" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email đã tồn tại.");
    expect(screen.getByLabelText("Họ tên")).toHaveValue("Bình");
  });
});
