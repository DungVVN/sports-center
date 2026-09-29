import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/api-error.js";
import { classApi } from "../classes/index.js";
import { memberApi } from "./member-api.js";
import { MembersPage } from "./MembersPage.jsx";

vi.mock("../classes/index.js", () => ({ classApi: { coaches: vi.fn() } }));
vi.mock("./member-api.js", () => ({ memberApi: { list: vi.fn(), create: vi.fn(), issueAccountCredentials: vi.fn(), get: vi.fn(), update: vi.fn(), replaceContacts: vi.fn(), coachAssignments: vi.fn(), assignCoach: vi.fn() } }));

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

  it("shows only the credential action when reset permission is granted without member.write", async () => {
    memberApi.list.mockResolvedValue([{ id: "member-1", memberCode: "HV-01", fullName: "An", email: "an@example.test", phone: "0900000000", hasAccount: true }]);
    renderPage({ readOnly: true, canResetCredentials: true });
    expect(await screen.findByText("An")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gửi lại MK" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
  });

  it("groups member dates, contact details and package status without losing row actions", async () => {
    memberApi.list.mockResolvedValue([{
      id: "member-1", memberCode: "MBR-1", fullName: "An", email: "an@example.test",
      phone: "0900000000", joinedAt: "2026-09-29", registeredPackageName: "Gói tháng",
      membershipStatus: "active", membershipExpiresOn: "2026-10-29", coachName: "Coach Bình",
      hasAccount: true,
    }]);
    renderPage({ canResetCredentials: true });

    const row = (await screen.findByText("MBR-1")).closest("tr");
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    expect(within(row).getAllByRole("cell")).toHaveLength(6);
    expect(row).toHaveTextContent("Tham gia: 29/9/2026");
    expect(row).toHaveTextContent("an@example.test");
    expect(row).toHaveTextContent("0900000000");
    expect(row).toHaveTextContent("Gói tháng");
    expect(row).toHaveTextContent("Đang hoạt động · Hết hạn 29/10/2026");
    expect(row).toHaveTextContent("Coach Bình");
    expect(within(row).getByRole("button", { name: "Gửi lại MK" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Sửa" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Coach" })).toBeInTheDocument();
    const actions = within(row).getByRole("group", { name: "Thao tác hội viên An" });
    expect(actions.querySelector(".member-row-actions__main")).toContainElement(within(row).getByRole("button", { name: "Sửa" }));
    expect(actions.querySelector(".member-row-actions__account")).toHaveTextContent("Gửi lại MK");
  });

  it("keeps account creation in the secondary action slot", async () => {
    memberApi.list.mockResolvedValue([{ id: "member-2", memberCode: "MBR-2", fullName: "Bình", email: "binh@example.test", hasAccount: false }]);
    renderPage({ canResetCredentials: true });
    const actions = await screen.findByRole("group", { name: "Thao tác hội viên Bình" });
    expect(actions.querySelector(".member-row-actions__account")).toHaveTextContent("Tạo tài khoản");
    expect(within(actions).getByRole("button", { name: "Tạo tài khoản" })).toBeEnabled();
  });

  it("creates a member and shows the standardized success feedback", async () => {
    memberApi.create.mockResolvedValue({ id: "member-2", accountCreated: true, credentialEmailDelivered: true });
    renderPage();
    await screen.findByText("Chưa có hội viên.");
    fireEvent.change(screen.getByLabelText("Họ tên"), { target: { value: "Bình" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "binh@example.com" } });
    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "0901" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo hội viên" }));
    await waitFor(() => expect(memberApi.create).toHaveBeenCalledWith({ fullName: "Bình", email: "binh@example.com", phone: "0901", createAccount: true }));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã tạo tài khoản hội viên và gửi mật khẩu tạm qua email.");
  });

  it("shows an API 409 message without discarding the form", async () => {
    memberApi.create.mockRejectedValue(new ApiError({ status: 409, message: "Email đã tồn tại." }));
    renderPage();
    await screen.findByText("Chưa có hội viên.");
    fireEvent.change(screen.getByLabelText("Họ tên"), { target: { value: "Bình" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "binh@example.com" } });
    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "0901" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo hội viên" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email đã tồn tại.");
    expect(screen.getByLabelText("Họ tên")).toHaveValue("Bình");
  });

  it("offers account creation for an existing member and sends the selected member id", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    memberApi.list.mockResolvedValue([{ id: "member-1", memberCode: "MBR-1", fullName: "An", email: "an@example.com", phone: "0900", hasAccount: false }]);
    memberApi.issueAccountCredentials.mockResolvedValue({ accountCreated: true, credentialEmailDelivered: true });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Tạo tài khoản" }));

    await waitFor(() => expect(memberApi.issueAccountCredentials).toHaveBeenCalledWith("member-1"));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã tạo tài khoản và gửi mật khẩu tạm qua email.");
    vi.unstubAllGlobals();
  });
});
