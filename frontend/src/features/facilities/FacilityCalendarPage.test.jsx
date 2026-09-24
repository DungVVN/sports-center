import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FacilityCalendarPage } from "./FacilityCalendarPage.jsx";
import { facilityApi } from "./facility-api.js";

vi.mock("./facility-api.js", () => ({ facilityApi: { calendar: vi.fn(), mine: vi.fn(), request: vi.fn(), reservations: vi.fn(), review: vi.fn(), cancel: vi.fn(), confirmCancellation: vi.fn() } }));
const day = { id: "day-1", facilityId: "court-1", date: "2099-09-25", free: [{ startMinute: 360, endMinute: 480 }], booked: [{ startMinute: 480, endMinute: 540 }] };
const result = { types: [{ id: "type-1", name: "Sân bóng" }], facilities: [{ id: "court-1", typeId: "type-1", name: "Sân A", openMinute: 360, closeMinute: 720 }], days: [day] };
function mount(props = {}) { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><FacilityCalendarPage {...props} /></QueryClientProvider>); }

describe("facility calendar", () => {
  beforeEach(() => { vi.clearAllMocks(); facilityApi.calendar.mockResolvedValue(result); facilityApi.mine.mockResolvedValue([]); });
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

  it("shows requester details and sends a cancellation request from a permitted account", async () => {
    facilityApi.reservations.mockResolvedValue([{ id: "booking-1", requesterName: "Nguyễn Minh", phone: "0901234567", participantCount: 4, facilityName: "Sân A", date: "2099-09-25", requestedStartMinute: 420, requestedEndMinute: 480, status: "pending" }]);
    facilityApi.cancel.mockResolvedValue({ id: "booking-1", cancellationPending: true });
    mount({ session: { user: { role: "coach", displayName: "Nhân viên" }, permissions: ["facility.booking.read", "facility.booking.cancel"] } });
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
    mount({ session: { user: { role: "member", displayName: "Nguyễn Minh" }, permissions: ["facility.booking.self.read"] } });
    expect(await screen.findByText(/Có yêu cầu hủy: Lễ tân cần đổi lịch/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
    expect(await screen.findByText("Đã xác nhận hủy đơn.")).toBeInTheDocument();
    expect(facilityApi.confirmCancellation).toHaveBeenCalledWith("booking-1");
  });
});
