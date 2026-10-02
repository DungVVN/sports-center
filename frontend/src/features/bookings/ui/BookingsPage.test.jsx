import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/api/api-error.js";
import { classApi } from "../../classes/index.js";
import { memberApi } from "../../members/index.js";
import { bookingApi } from "../api/booking-api.js";
import { BookingsPage } from "./BookingsPage.jsx";
import { apiClient } from "../../../shared/api/client.js";

vi.mock("../../../shared/api/client.js", () => ({ apiClient: { get: vi.fn() } }));

vi.mock("../../classes/index.js", () => ({ classApi: { list: vi.fn() } }));
vi.mock("../../members/index.js", () => ({ memberApi: { list: vi.fn() } }));
vi.mock("../api/booking-api.js", () => ({ bookingApi: { list: vi.fn(), create: vi.fn(), cancel: vi.fn() } }));

const memberSession = { user: { role: "member", id: "member-1" }, permissions: ["booking.read", "booking.write"] };
const futureClass = { id: "class-1", name: "Yoga", status: "published", starts_at: "2099-01-01T09:00:00.000Z" };

function renderPage(session = memberSession) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><BookingsPage session={session} /></QueryClientProvider>);
}

describe("BookingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bookingApi.list.mockResolvedValue([]);
    classApi.list.mockResolvedValue([futureClass]);
    memberApi.list.mockResolvedValue([]);
  });
  afterEach(cleanup);

  it("lets Admin inspect a cancelled booking and its own history without cancelling twice", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    bookingApi.list.mockResolvedValue([{ id, booking_code: "BKG-01", status: "cancelled", booked_at: "2026-10-01T01:00:00Z", cancel_reason: "Hội viên đổi lịch", class_session: futureClass }]);
    apiClient.get.mockResolvedValue({ items: [{ id: "log-1", summary: "Đã hủy đặt chỗ.", reason: "Hội viên đổi lịch", occurred_at: "2026-10-02T01:00:00Z", actor: { name: "Admin" } }], pagination: { page: 1, totalPages: 1 } });
    renderPage({ user: { role: "admin" }, permissions: [] });
    fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết" }));
    expect(await screen.findByText("Đã hủy đặt chỗ.")).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining(`entityType=booking&entityId=${id}`));
    expect(screen.queryByRole("button", { name: "Hủy", exact: true })).not.toBeInTheDocument();
    expect(bookingApi.cancel).not.toHaveBeenCalled();
  });

  it("shows the empty booking state", async () => {
    renderPage();
    expect(await screen.findByText("Chưa có lịch đặt chỗ.")).toBeInTheDocument();
  });

  it("does not load booking references when booking.write is unavailable", async () => {
    renderPage({ user: { role: "member" }, permissions: ["booking.read"] });
    await screen.findByText("Chưa có lịch đặt chỗ.");
    expect(classApi.list).not.toHaveBeenCalled();
    expect(screen.queryByText("Đặt chỗ lớp học")).not.toBeInTheDocument();
  });

  it("creates a booking and shows waitlist feedback", async () => {
    bookingApi.create.mockResolvedValue({ status: "waitlisted" });
    renderPage();
    await screen.findByText("Chưa có lịch đặt chỗ.");
    fireEvent.click(screen.getByRole("button", { name: "Lớp học" }));
    fireEvent.click(await screen.findByRole("option", { name: /Yoga/ }));
    fireEvent.click(screen.getByRole("button", { name: "Đặt chỗ" }));
    await waitFor(() => expect(bookingApi.create).toHaveBeenCalledWith({ classId: "class-1" }));
    expect(await screen.findByRole("status")).toHaveTextContent("danh sách chờ");
  });

  it("renders the API 409 conflict message", async () => {
    bookingApi.create.mockRejectedValue(new ApiError({ status: 409, message: "Hội viên đã đặt lớp này." }));
    renderPage();
    await screen.findByText("Chưa có lịch đặt chỗ.");
    fireEvent.click(screen.getByRole("button", { name: "Lớp học" }));
    fireEvent.click(await screen.findByRole("option", { name: /Yoga/ }));
    fireEvent.click(screen.getByRole("button", { name: "Đặt chỗ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Hội viên đã đặt lớp này.");
  });

  it.each([
    [null, "Đã hủy đặt chỗ."],
    ["promoted-1", "Đã hủy đặt chỗ và tự động xác nhận hội viên đủ điều kiện trong danh sách chờ."],
  ])("reports promotion accurately after cancelling a booking (%s)", async (promotedBookingId, expectedMessage) => {
    bookingApi.list.mockResolvedValue([{ id: "booking-1", booking_code: "BKG-001", status: "confirmed", class_session: futureClass, booked_at: "2026-09-29T00:00:00.000Z" }]);
    bookingApi.cancel.mockResolvedValue({ id: "booking-1", status: "cancelled", promotedBookingId });
    renderPage();
    const cancelButton = await screen.findByRole("button", { name: "Hủy" });
    fireEvent.click(cancelButton);
    fireEvent.change(screen.getByLabelText("Lý do hủy"), { target: { value: "Kiểm thử QA" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
    await waitFor(() => expect(bookingApi.cancel).toHaveBeenCalledWith("booking-1", "Kiểm thử QA"));
    expect(await screen.findByRole("status")).toHaveTextContent(expectedMessage);
  });
});
