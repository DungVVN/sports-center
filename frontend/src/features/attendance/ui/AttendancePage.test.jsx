import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/api/api-error.js";
import { bookingApi } from "../../bookings/index.js";
import { classApi } from "../../classes/index.js";
import { attendanceApi } from "../api/attendance-api.js";
import { AttendancePage } from "./AttendancePage.jsx";

vi.mock("../../bookings/index.js", () => ({ bookingApi: { byClass: vi.fn() } }));
vi.mock("../../classes/index.js", () => ({ classApi: { list: vi.fn() } }));
vi.mock("../api/attendance-api.js", () => ({ attendanceApi: { byClass: vi.fn(), submit: vi.fn(), correct: vi.fn(), checkOut: vi.fn() } }));

const activeClass = { id: "class-1", code: "CLS-1", name: "Yoga", status: "published", starts_at: new Date(Date.now() - 60_000).toISOString(), ends_at: new Date(Date.now() + 3_600_000).toISOString(), capacity: 12, type: "group" };
const session = { user: { role: "admin", id: "admin-1" }, permissions: ["attendance.read", "attendance.write"] };
const booking = { id: "booking-1", member_id: "member-1", status: "confirmed", member: { full_name: "Bình", member_code: "HV-01" } };

function renderPage(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AttendancePage session={session} {...props} /></QueryClientProvider>);
}

describe("AttendancePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classApi.list.mockResolvedValue([activeClass]);
    bookingApi.byClass.mockResolvedValue([booking]);
    attendanceApi.byClass.mockResolvedValue([]);
  });
  afterEach(cleanup);

  it("shows the empty class state", async () => {
    classApi.list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Chưa có buổi học để xem điểm danh.")).toBeInTheDocument();
  });

  it("keeps attendance mutation controls hidden without attendance.write", async () => {
    attendanceApi.byClass.mockResolvedValue([{ id: "attendance-1", member_id: "member-1", status: "present", checked_in_at: new Date().toISOString(), checked_out_at: null, member: booking.member }]);
    renderPage({ session: { user: { role: "receptionist" }, permissions: ["attendance.read"] } });
    await screen.findByText("Yoga");
    fireEvent.click(screen.getByRole("button", { name: "Xem điểm danh" }));
    expect(await screen.findByText("Bình")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu điểm danh" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check-out" })).not.toBeInTheDocument();
  });

  it("submits attendance and shows success feedback", async () => {
    attendanceApi.submit.mockResolvedValue({ notificationCount: 1, alreadySubmitted: false });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Xem điểm danh" }));
    await screen.findByText("Bình");
    fireEvent.click(screen.getByRole("button", { name: "Lưu điểm danh" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận lưu" }));
    await waitFor(() => expect(attendanceApi.submit).toHaveBeenCalledWith("class-1", [{ bookingId: "booking-1", status: "absent" }]));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu điểm danh");
  });

  it("shows an API 409 conflict message after submit", async () => {
    attendanceApi.submit.mockRejectedValue(new ApiError({ status: 409, message: "Buổi học đã bị khóa." }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Xem điểm danh" }));
    await screen.findByText("Bình");
    fireEvent.click(screen.getByRole("button", { name: "Lưu điểm danh" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận lưu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Buổi học đã bị khóa.");
  });

  it("confirms check-out, refreshes the row, and hides repeat action", async () => {
    const checkedIn = { id: "attendance-1", member_id: "member-1", status: "present", checked_in_at: new Date().toISOString(), checked_out_at: null, member: booking.member };
    const checkedOut = { ...checkedIn, checked_out_at: new Date().toISOString() };
    attendanceApi.byClass.mockResolvedValueOnce([checkedIn]).mockResolvedValue([checkedOut]);
    attendanceApi.checkOut.mockResolvedValue(checkedOut);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Xem điểm danh" }));
    fireEvent.click(await screen.findByRole("button", { name: "Check-out" }));
    expect(screen.getByText("Check-out cho Bình?")).toBeInTheDocument();
    expect(attendanceApi.checkOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận check-out" }));
    await waitFor(() => expect(attendanceApi.checkOut).toHaveBeenCalledWith("attendance-1"));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã check-out buổi học.");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Check-out" })).not.toBeInTheDocument());
  });
});
