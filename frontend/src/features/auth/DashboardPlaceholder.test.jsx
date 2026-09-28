import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPlaceholder } from "./DashboardPlaceholder.jsx";
import { dashboardApi } from "../dashboard/dashboard-api.js";

const showToast = vi.hoisted(() => vi.fn());

vi.mock("../../components/layout/AppShell.jsx", () => ({ AppShell: ({ navigation }) => <nav>{navigation.flatMap((item) => [item, ...(item.children ?? [])]).map((item) => <span key={item.id}>{item.label}</span>)}</nav> }));
vi.mock("../dashboard/dashboard-api.js", () => ({ dashboardApi: { notifications: vi.fn().mockResolvedValue([]) } }));
vi.mock("../../contexts/useToast.js", () => ({ useToast: () => showToast }));

describe("role navigation", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); dashboardApi.notifications.mockResolvedValue([]); });

  it("does not invent a cash payment notification on a timer", async () => {
    vi.useFakeTimers();
    render(<DashboardPlaceholder session={{ user: { role: "receptionist" }, permissions: [] }} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(46_000); });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("toasts only a newly returned unread notification", async () => {
    vi.useFakeTimers();
    dashboardApi.notifications.mockResolvedValueOnce([]).mockResolvedValue([{ id: "new-1", title: "Phiếu thu mới", read: false }]);
    render(<DashboardPlaceholder session={{ user: { role: "receptionist" }, permissions: [] }} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(showToast).toHaveBeenCalledExactlyOnceWith("Phiếu thu mới", "info");
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
