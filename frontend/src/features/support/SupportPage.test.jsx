import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/api-error.js";
import { SupportPage } from "./ui/SupportPage.jsx";
import { SupportStaffPage } from "./ui/SupportStaffPage.jsx";
import { supportApi } from "./api/support-api.js";

vi.mock("./api/support-api.js", () => ({
  supportApi: {
    assignSelf: vi.fn(),
    create: vi.fn(),
    detail: vi.fn(),
    list: vi.fn(),
    respond: vi.fn(),
  },
}));

let activeClient;
const memberSession = { user: { role: "member" }, permissions: ["support.ticket.create"] };
const staffSession = { user: { role: "staff" }, permissions: ["support.ticket.respond"] };
const ticket = { id: "ticket-1", ticket_code: "HT-001", subject: "Cần hỗ trợ", status: "open", priority: "normal" };

function renderPage(Page, session) {
  activeClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={activeClient}><Page session={session} /></QueryClientProvider>);
}

describe("support pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supportApi.list.mockImplementation(() => Promise.resolve([]));
    supportApi.detail.mockImplementation(() => Promise.resolve({ ticket, responses: [] }));
  });

  afterEach(() => {
    cleanup();
    activeClient?.clear();
    activeClient = undefined;
  });

  it("hides the member ticket form without create permission", async () => {
    renderPage(SupportPage, { user: { role: "member" }, permissions: [] });
    expect(await screen.findByText("Chưa có yêu cầu hỗ trợ.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gửi yêu cầu" })).not.toBeInTheDocument();
  });

  it("renders the empty support-ticket state", async () => {
    renderPage(SupportPage, memberSession);
    expect(await screen.findByText("Chưa có yêu cầu hỗ trợ.")).toBeInTheDocument();
  });

  it("creates a ticket and renders shared success feedback", async () => {
    supportApi.create.mockResolvedValue(ticket);
    renderPage(SupportPage, memberSession);
    fireEvent.change(await screen.findByLabelText("Tiêu đề"), { target: { value: "Cần hỗ trợ" } });
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Không mở được lịch tập" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    await waitFor(() => expect(supportApi.create).toHaveBeenCalledWith({ subject: "Cần hỗ trợ", body: "Không mở được lịch tập", priority: "normal" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã gửi yêu cầu hỗ trợ.");
  });

  it("shows an API 409 conflict when creating a ticket", async () => {
    supportApi.create.mockRejectedValue(new ApiError({ status: 409, message: "Ticket trùng lặp." }));
    renderPage(SupportPage, memberSession);
    fireEvent.change(await screen.findByLabelText("Tiêu đề"), { target: { value: "Cần hỗ trợ" } });
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Không mở được lịch tập" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ticket trùng lặp.");
  });

  it("responds to a selected ticket with staff permission", async () => {
    supportApi.list.mockImplementation(() => Promise.resolve([ticket]));
    supportApi.respond.mockResolvedValue({});
    renderPage(SupportStaffPage, staffSession);
    fireEvent.click(await screen.findByRole("button", { name: "Xử lý" }));
    fireEvent.change(await screen.findByLabelText("Phản hồi"), { target: { value: "Trung tâm đã kiểm tra." } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi phản hồi" }));
    await waitFor(() => expect(supportApi.respond).toHaveBeenCalledWith("ticket-1", { body: "Trung tâm đã kiểm tra.", status: "in_progress" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã gửi phản hồi cho hội viên.");
  });
});
