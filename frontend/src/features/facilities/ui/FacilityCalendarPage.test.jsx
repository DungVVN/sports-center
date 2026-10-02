import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FacilityCalendarPage } from "./FacilityCalendarPage.jsx";
import { facilityApi } from "../api/facility-api.js";

vi.mock("../api/facility-api.js", () => ({ facilityApi: { calendar: vi.fn(), mine: vi.fn(), request: vi.fn(), reservations: vi.fn(), review: vi.fn(), cancel: vi.fn(), confirmCancellation: vi.fn(), settings: vi.fn() } }));
const day = { id: "day-1", facilityId: "court-1", date: "2099-09-25", free: [{ startMinute: 360, endMinute: 480 }], booked: [{ startMinute: 480, endMinute: 540 }] };
const result = { types: [{ id: "type-1", name: "Sân bóng" }], facilities: [{ id: "court-1", typeId: "type-1", name: "Sân A", openMinute: 360, closeMinute: 720 }], days: [day] };
function mount(props = {}) { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><FacilityCalendarPage {...props} /></QueryClientProvider>); }

describe("facility calendar", () => {
  it("defaults to one day and switches to seven days with navigation and a court filter", async () => {
    facilityApi.calendar.mockResolvedValue({ ...result, facilities: [...result.facilities, { ...result.facilities[0], id: "court-2", name: "Sân B" }], days: [day, { ...day, id: "day-2", facilityId: "court-2" }] });
    mount();
    await screen.findByText("Sân B");
    const from = screen.getByLabelText("Ngày").value;
    expect(facilityApi.calendar).toHaveBeenCalledWith({ from, to: from, typeId: "" });
    fireEvent.change(screen.getByLabelText("Sân"), { target: { value: "court-1" } });
    expect(screen.queryByText("Sân B")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Chế độ xem"), { target: { value: "week" } });
    const lastDay = new Date(Date.parse(`${from}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
    await waitFor(() => expect(facilityApi.calendar).toHaveBeenCalledWith({ from, to: lastDay, typeId: "" }));
    fireEvent.click(screen.getByRole("button", { name: "Tuần sau" }));
    expect(screen.getByLabelText("Ngày").value).toBe(new Date(Date.parse(`${from}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10));
  });

  it("links each workspace tab to a stable route and only loads orders on their tab", async () => {
    const onNavigate = vi.fn();
    mount({ session: { user: { role: "admin" }, permissions: [] }, onNavigate });
    const orders = screen.getByRole("link", { name: "Đơn đặt sân" });
    expect(orders).toHaveAttribute("href", "/facilities/reservations");
    expect(screen.getByRole("link", { name: "Cấu hình sân" })).toHaveAttribute("href", "/facilities/settings");
    expect(screen.getByRole("link", { name: "Lịch & đặt sân" })).toHaveAttribute("aria-current", "page");
    await screen.findByText("Sân A");
    expect(facilityApi.mine).not.toHaveBeenCalled();
    expect(facilityApi.reservations).not.toHaveBeenCalled();
    expect(facilityApi.settings).not.toHaveBeenCalled();
    fireEvent.click(orders);
    expect(onNavigate).toHaveBeenCalledWith("facility-reservations");
  });

  it("shows configuration alone to authorized managers and blocks members at its direct route", async () => {
    const { unmount } = mount({ tab: "settings", session: { user: { role: "manager" }, permissions: ["facility.manage"] } });
    expect(await screen.findByRole("heading", { name: "Giá thuê và phòng dùng chung" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Đơn đặt của tôi" })).not.toBeInTheDocument();
    unmount();
    vi.clearAllMocks();
    mount({ tab: "settings", session: { user: { role: "member" }, permissions: ["facility.manage", "facility.booking.self.read"] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Bạn không có quyền truy cập mục này.");
    expect(screen.queryByRole("link", { name: "Cấu hình sân" })).not.toBeInTheDocument();
    expect(facilityApi.settings).not.toHaveBeenCalled();
    expect(facilityApi.calendar).not.toHaveBeenCalled();
  });

  it("keeps a member's orders and cancellation form inside the orders tab", async () => {
    facilityApi.mine.mockResolvedValue([{ id: "mine-1", facilityName: "Sân của tôi", date: "2099-09-25", requestedStartMinute: 420, requestedEndMinute: 480, status: "approved" }]);
    mount({ session: { user: { role: "member" }, permissions: ["facility.booking.self.read", "facility.booking.cancel"] } });
    await screen.findByText("Sân A");
    expect(screen.queryByRole("heading", { name: "Đơn đặt của tôi" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Đơn đặt sân" }));
    fireEvent.click(await screen.findByRole("button", { name: "Hủy đơn" }));
    expect(screen.getByLabelText("Lý do hủy")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(facilityApi.reservations).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Lịch & đặt sân" }));
    expect(screen.queryByLabelText("Lý do hủy")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
  it("keeps member self-cancellation visible without fetching other people's reservations", async () => {
    facilityApi.mine.mockResolvedValue([{ id: "mine-1", facilityName: "Sân của tôi", date: "2099-09-25", requestedStartMinute: 420, requestedEndMinute: 480, status: "approved" }]);
    mount({ tab: "reservations", session: { user: { role: "member" }, permissions: ["facility.booking.self.read", "facility.booking.cancel", "facility.booking.read"] } });
    expect(await screen.findByRole("button", { name: "Hủy đơn" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Yêu cầu đặt sân" })).not.toBeInTheDocument();
    expect(facilityApi.reservations).not.toHaveBeenCalled();
  });
  beforeEach(() => { vi.clearAllMocks(); facilityApi.calendar.mockResolvedValue(result); facilityApi.mine.mockResolvedValue([]); facilityApi.settings.mockResolvedValue({ facilities: [], rooms: [] }); });
  afterEach(cleanup);

  it("shows public free and booked time without personal data", async () => {
    const onLoginClick = vi.fn();
    mount({ onLoginClick });
    expect(await screen.findByText("Sân A")).toBeInTheDocument();
    expect(screen.getByText("06:00–08:00")).toBeInTheDocument();
    expect(screen.getByText("08:00–09:00")).toBeInTheDocument();
    expect(screen.queryByText("0901234567")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đặt sân ngay" }));
    expect(onLoginClick).toHaveBeenCalledOnce();
  });

  it("keeps the schedule table visible when no booking day is open", async () => {
    facilityApi.calendar.mockResolvedValue({ types: [], facilities: [], days: [] });
    mount();
    expect(screen.getByRole("table", { name: /Lịch sân từ/ })).toBeInTheDocument();
    expect(await screen.findByText("Chưa có ngày mở đặt sân trong khoảng đã chọn.")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Giờ trống" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Đã đặt" })).toBeInTheDocument();
  });

  it("lets a permitted member submit a request with profile name shown", async () => {
    facilityApi.request.mockResolvedValue({ id: "booking-1", status: "pending" });
    mount({ session: { user: { role: "member", displayName: "Nguyễn Minh" }, permissions: ["facility.booking.request", "facility.booking.self.read"] } });
    expect(await screen.findByText("Sân A")).toBeInTheDocument();
    expect(screen.getByText(/Người đặt: Nguyễn Minh/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu đặt ngày này" }));
    fireEvent.change(screen.getByLabelText("Giờ bắt đầu"), { target: { value: "07:00" } });
    fireEvent.change(screen.getByLabelText("Giờ kết thúc"), { target: { value: "08:00" } });
    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "0901234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(await screen.findByText("Đã gửi yêu cầu, vui lòng chờ Lễ tân duyệt.")).toBeInTheDocument();
    expect(facilityApi.request).toHaveBeenCalledWith({ dayId: "day-1", startMinute: 420, endMinute: 480, participantCount: 1, phone: "0901234567" });
  });

  it("rejects reversed request times before calling the API", async () => {
    mount({ session: { user: { role: "member", displayName: "Nguyễn Minh" }, permissions: ["facility.booking.request"] } });
    expect(await screen.findByText("Sân A")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu đặt ngày này" }));
    fireEvent.change(screen.getByLabelText("Giờ bắt đầu"), { target: { value: "12:00" } });
    fireEvent.change(screen.getByLabelText("Giờ kết thúc"), { target: { value: "11:00" } });
    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "0901234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Giờ kết thúc phải sau giờ bắt đầu.");
    expect(facilityApi.request).not.toHaveBeenCalled();
  });

  it("shows requester details and sends a cancellation request from a permitted account", async () => {
    facilityApi.reservations.mockResolvedValue([{ id: "booking-1", requesterName: "Nguyễn Minh", phone: "0901234567", participantCount: 4, facilityName: "Sân A", date: "2099-09-25", requestedStartMinute: 420, requestedEndMinute: 480, status: "pending" }]);
    facilityApi.cancel.mockResolvedValue({ id: "booking-1", cancellationPending: true });
    mount({ tab: "reservations", session: { user: { role: "coach", displayName: "Nhân viên" }, permissions: ["facility.booking.read", "facility.booking.cancel"] } });
    expect(await screen.findByText("Nguyễn Minh")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hủy đơn" }));
    fireEvent.change(screen.getByLabelText("Lý do hủy"), { target: { value: "Khách đổi lịch" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
    expect(await screen.findByText("Đã gửi yêu cầu hủy, chờ người tạo đơn xác nhận.")).toBeInTheDocument();
    expect(facilityApi.cancel).toHaveBeenCalledWith("booking-1", "Khách đổi lịch");
  });

  it("lets the creator confirm a pending cancellation", async () => {
    facilityApi.mine.mockResolvedValue([{ id: "booking-1", facilityName: "Sân A", date: "2099-09-25", requestedStartMinute: 420, requestedEndMinute: 480, status: "approved", cancellationPending: true, cancellationReason: "Lễ tân cần đổi lịch" }]);
    facilityApi.confirmCancellation.mockResolvedValue({ id: "booking-1", status: "cancelled" });
    mount({ tab: "reservations", session: { user: { role: "member", displayName: "Nguyễn Minh" }, permissions: ["facility.booking.self.read"] } });
    expect(await screen.findByText(/Có yêu cầu hủy: Lễ tân cần đổi lịch/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
    expect(await screen.findByText("Đã xác nhận hủy đơn.")).toBeInTheDocument();
    expect(facilityApi.confirmCancellation).toHaveBeenCalledWith("booking-1");
  });

  it("does not offer confirmation for an already cancelled reservation with retained audit metadata", async () => {
    facilityApi.mine.mockResolvedValue([{ id: "booking-1", facilityName: "Sân A", date: "2099-09-25", requestedStartMinute: 420, requestedEndMinute: 480, status: "cancelled", cancellationPending: true, cancellationReason: "Đổi lịch sân" }]);
    mount({ tab: "reservations", session: { user: { role: "member", displayName: "Nguyễn Minh" }, permissions: ["facility.booking.self.read"] } });
    expect(await screen.findByText(/Đã hủy/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xác nhận hủy" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Có yêu cầu hủy/)).not.toBeInTheDocument();
  });
});
