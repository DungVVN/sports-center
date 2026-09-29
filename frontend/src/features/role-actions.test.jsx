import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClassesPage } from "./classes/ClassesPage.jsx";
import { BookingsPage } from "./bookings/BookingsPage.jsx";
import { AttendancePage } from "./attendance/AttendancePage.jsx";
import { MembershipsPage } from "./memberships/MembershipsPage.jsx";
import { PaymentsPage } from "./payments/PaymentsPage.jsx";
import { bookingApi } from "./bookings/booking-api.js";
import { classApi } from "./classes/class-api.js";
import { memberApi } from "./members/member-api.js";
import { membershipApi } from "./memberships/membership-api.js";
import { paymentApi } from "./payments/payment-api.js";

vi.mock("./classes/class-api.js", () => ({ classApi: { list: vi.fn(), rooms: vi.fn(), coaches: vi.fn(), changeRequests: vi.fn() } }));
vi.mock("./bookings/booking-api.js", () => ({ bookingApi: { list: vi.fn() } }));
vi.mock("./memberships/membership-api.js", () => ({ membershipApi: { packages: vi.fn(), freezeRequests: vi.fn() } }));
vi.mock("./payments/payment-api.js", () => ({ paymentApi: { list: vi.fn() } }));
vi.mock("./members/member-api.js", () => ({ memberApi: { list: vi.fn() } }));

function renderWorkspace(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("permission-backed role actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classApi.list.mockResolvedValue([]);
    classApi.rooms.mockResolvedValue([]);
    classApi.coaches.mockResolvedValue([]);
    classApi.changeRequests.mockResolvedValue([]);
    bookingApi.list.mockResolvedValue([]);
    memberApi.list.mockResolvedValue([]);
    membershipApi.packages.mockResolvedValue([]);
    membershipApi.freezeRequests.mockResolvedValue([]);
    paymentApi.list.mockResolvedValue([]);
  });
  afterEach(cleanup);

  it("keeps Manager payment read-only", async () => {
    renderWorkspace(<PaymentsPage session={{ user: { role: "manager" }, permissions: ["payment.read"] }} />);
    await waitFor(() => expect(paymentApi.list).toHaveBeenCalled());
    expect(screen.queryByText("Tạo chờ thanh toán")).not.toBeInTheDocument();
  });

  it("does not request the class-review queue for Manager", async () => {
    renderWorkspace(<ClassesPage session={{ user: { role: "manager" }, permissions: ["class.read", "class.manage"] }} />);
    await waitFor(() => expect(classApi.list).toHaveBeenCalled());
    expect(classApi.changeRequests).not.toHaveBeenCalled();
  });

  it("loads and shows the freeze-review queue for authorized Admin", async () => {
    renderWorkspace(<MembershipsPage mode="catalog" session={{ user: { role: "admin" }, permissions: ["membership.freeze.review", "membership.package.manage"] }} />);
    await waitFor(() => expect(membershipApi.freezeRequests).toHaveBeenCalled());
    expect(membershipApi.freezeRequests).toHaveBeenCalledWith("pending");
    expect(screen.getByText("Yêu cầu đóng băng chờ duyệt")).toBeInTheDocument();
  });

  it("loads the class-review queue with the pending status", async () => {
    renderWorkspace(<ClassesPage session={{ user: { role: "admin" }, permissions: ["class.read", "class.change.review"] }} />);
    await waitFor(() => expect(classApi.changeRequests).toHaveBeenCalledWith("pending"));
  });

  it("lets Admin reach membership assignment", async () => {
    renderWorkspace(<MembershipsPage mode="assign" session={{ user: { role: "admin" }, permissions: ["membership.assign", "membership.freeze.review"] }} />);
    await waitFor(() => expect(memberApi.list).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Tạo gói cho hội viên" })).toBeInTheDocument();
  });

  it("shows Admin the booking form when booking.write is granted", async () => {
    renderWorkspace(<BookingsPage session={{ user: { role: "admin" }, permissions: ["booking.write", "booking.read"] }} />);
    await waitFor(() => expect(bookingApi.list).toHaveBeenCalled());
    expect(screen.getByText("Đặt lớp")).toBeInTheDocument();
  });

  it("lets Admin inspect completed classes for attendance corrections", async () => {
    classApi.list.mockResolvedValue([{ id: "class-1", code: "CLS-1", name: "Buổi đã kết thúc", status: "completed", starts_at: new Date(Date.now() - 86_400_000).toISOString(), ends_at: new Date(Date.now() - 82_800_000).toISOString(), coach_user_id: "coach-1" }]);
    renderWorkspace(<AttendancePage session={{ user: { role: "admin", id: "admin-1" }, permissions: ["attendance.read", "attendance.write"] }} />);
    expect(await screen.findByText("Buổi đã kết thúc")).toBeInTheDocument();
  });
});
