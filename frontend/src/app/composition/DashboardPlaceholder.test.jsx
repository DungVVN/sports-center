import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPlaceholder } from "./DashboardPlaceholder.jsx";
import { dashboardApi } from "../../features/dashboard/index.js";
import { mutationSucceededEvent } from "../../shared/api/client.js";

const showToast = vi.hoisted(() => vi.fn());

vi.mock("../layouts/AppShell.jsx", () => ({ AppShell: ({ navigation, currentView }) => <nav data-view={currentView}>{navigation.flatMap((item) => [item, ...(item.children ?? [])]).map((item) => <span key={item.id}>{item.label}</span>)}</nav> }));
vi.mock("../../features/dashboard/index.js", () => ({ dashboardApi: { notifications: vi.fn().mockResolvedValue([]) } }));
vi.mock("../../shared/ui/useToast.js", () => ({ useToast: () => showToast }));

describe("role navigation", () => {
  it.each([
    ["admin", [], "/facilities/settings"],
    ["manager", ["facility.manage"], "/facilities/settings"],
    ["member", ["facility.booking.self.read"], "/facilities/reservations"],
  ])("restores an authorized facility tab for %s after refresh", (role, permissions, path) => {
    window.history.replaceState({}, "", path);
    render(<DashboardPlaceholder session={{ user: { role }, permissions }} />);
    expect(window.location.pathname).toBe(path);
    expect(screen.getByRole("navigation")).toHaveAttribute("data-view", "facility-calendar");
    window.history.replaceState({}, "", "/dashboard");
  });

  it("rejects the configuration deep link for a member", () => {
    window.history.replaceState({}, "", "/facilities/settings");
    render(<DashboardPlaceholder session={{ user: { role: "member" }, permissions: ["facility.booking.self.read"] }} />);
    expect(window.location.pathname).toBe("/dashboard");
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); dashboardApi.notifications.mockResolvedValue([]); });

  it("prioritizes admin governance ahead of daily operations", () => {
    render(<DashboardPlaceholder session={{ user: { role: "admin" }, permissions: [] }} />);
    expect(screen.getByRole("navigation").textContent).toBe([
      "Tổng quan", "Nhân sự & phân quyền", "Phân quyền chức năng", "Danh tính & nhân sự",
      "Báo cáo & nhật kí", "Nhật kí hoạt động", "Báo cáo", "Website", "Trang website", "Menu website",
      "Thanh toán", "Quản lý hội viên", "Hội viên", "Duyệt đăng ký",
      "Gói tập", "Tạo gói tập", "Danh mục gói", "Gán gói hội viên",
      "Lịch & hoạt động", "Huấn luyện cá nhân", "Khóa có hướng dẫn", "Lớp học", "Đặt chỗ", "Lịch sân", "Điểm danh",
      "Giáo án", "Hỗ trợ", "Hồ sơ",
    ].join(""));
    cleanup();
    render(<DashboardPlaceholder session={{ user: { role: "manager" }, permissions: ["staff.manage", "report.read", "payment.read"] }} />);
    const labels = [...screen.getByRole("navigation").querySelectorAll("span")].map((item) => item.textContent);
    expect(labels.indexOf("Hồ sơ")).toBeLessThan(labels.indexOf("Thanh toán"));
    expect(labels.indexOf("Thanh toán")).toBeLessThan(labels.indexOf("Nhân sự & phân quyền"));
  });

  it.each(["admin", "manager", "receptionist", "coach", "member"])("refreshes %s notifications immediately after submit and every two seconds", async (role) => {
    vi.useFakeTimers();
    dashboardApi.notifications.mockResolvedValueOnce([]).mockResolvedValue([{ id: "notice-1", title: "Cập nhật khóa học thành công", read_at: null }]);
    const { unmount } = render(<DashboardPlaceholder session={{ user: { role }, permissions: [] }} />);
    await act(async () => { await Promise.resolve(); });
    expect(dashboardApi.notifications).toHaveBeenCalledTimes(1);
    await act(async () => { window.dispatchEvent(new Event(mutationSucceededEvent)); });
    expect(dashboardApi.notifications).toHaveBeenCalledTimes(2);
    expect(showToast).toHaveBeenCalledExactlyOnceWith("Cập nhật khóa học thành công", "info");
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(dashboardApi.notifications).toHaveBeenCalledTimes(3);
    expect(showToast).toHaveBeenCalledTimes(1);
    unmount();
    window.dispatchEvent(new Event(mutationSucceededEvent));
    expect(dashboardApi.notifications).toHaveBeenCalledTimes(3);
  });

  it("filters children inside groups and hides empty admin groups", () => {
    render(<DashboardPlaceholder session={{ user: { role: "coach" }, permissions: ["class.read"] }} />);
    expect(screen.getByText("Lịch & hoạt động")).toBeInTheDocument();
    expect(screen.getByText("Lớp học")).toBeInTheDocument();
    expect(screen.queryByText("Đặt chỗ")).not.toBeInTheDocument();
    expect(screen.queryByText("Website")).not.toBeInTheDocument();
    expect(screen.queryByText("Nhân sự & phân quyền")).not.toBeInTheDocument();
    expect(screen.queryByText("Báo cáo & nhật kí")).not.toBeInTheDocument();
  });

  it("does not invent a cash payment notification on a timer", async () => {
    vi.useFakeTimers();
    render(<DashboardPlaceholder session={{ user: { role: "receptionist" }, permissions: [] }} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(46_000); });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("toasts only a newly returned unread notification", async () => {
    vi.useFakeTimers();
    dashboardApi.notifications.mockResolvedValueOnce([]).mockResolvedValue([{ id: "new-1", title: "Phiếu thu mới", read_at: null }, { id: "read-1", title: "Đã đọc ở phiên khác", read_at: "2026-10-02T00:00:00Z" }]);
    render(<DashboardPlaceholder session={{ user: { role: "receptionist" }, permissions: [] }} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(showToast).toHaveBeenCalledExactlyOnceWith("Phiếu thu mới", "info");
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it("hides registration approval from Manager when the permission was removed", () => {
    render(<DashboardPlaceholder session={{ user: { role: "manager" }, permissions: ["payment.read", "class.read"] }} />);
    expect(screen.queryByText("Duyệt đăng ký")).not.toBeInTheDocument();
    expect(screen.getByText("Thanh toán")).toBeInTheDocument();
  });

  it("keeps registration approval for authorized Receptionist and Admin", () => {
    for (const role of ["receptionist", "admin"]) {
      const { unmount } = render(<DashboardPlaceholder session={{ user: { role }, permissions: ["registration.approve"] }} />);
      expect(screen.getByText("Duyệt đăng ký")).toBeInTheDocument();
      unmount();
    }
  });

  it("exposes membership assignment only to an authorized Admin", () => {
    const { unmount } = render(<DashboardPlaceholder session={{ user: { role: "admin" }, permissions: ["membership.assign"] }} />);
    expect(screen.getByText("Gán gói hội viên")).toBeInTheDocument();
    unmount();
    render(<DashboardPlaceholder session={{ user: { role: "manager" }, permissions: [] }} />);
    expect(screen.queryByText("Gán gói hội viên")).not.toBeInTheDocument();
  });

  it("builds shared navigation from permissions rather than fixed role menus", () => {
    const { unmount } = render(<DashboardPlaceholder session={{ user: { role: "coach" }, permissions: ["payment.read", "support.ticket.read"] }} />);
    expect(screen.getByText("Thanh toán")).toBeInTheDocument();
    expect(screen.getByText("Hỗ trợ")).toBeInTheDocument();
    expect(screen.queryByText("Lớp học")).not.toBeInTheDocument();
    unmount();
    render(<DashboardPlaceholder session={{ user: { role: "receptionist" }, permissions: [] }} />);
    expect(screen.getByText("Hồ sơ")).toBeInTheDocument();
    expect(screen.queryByText("Thanh toán")).not.toBeInTheDocument();
  });
});
