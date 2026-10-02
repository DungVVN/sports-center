import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell.jsx";

function renderShell() {
  return render(
    <AppShell
      currentView="dashboard"
      navigation={[{ id: "dashboard", label: "Tổng quan" }, { id: "members", label: "Hội viên" }]}
      notifications={[]}
      onLogout={vi.fn()}
      onNavigate={vi.fn()}
      onReadNotification={vi.fn()}
      roleLabel="Quản lý trung tâm"
    >
      <h1>Tình hình trung tâm</h1>
    </AppShell>,
  );
}

describe("AppShell mobile navigation", () => {
  afterEach(cleanup);

  it("shows the arrival date and time in Vietnam time and retains the read action", () => {
    const onRead = vi.fn();
    render(<AppShell currentView="dashboard" navigation={[]} notifications={[{ id: "notice-1", title: "Cập nhật khóa học thành công", body: "Admin đã cập nhật.", created_at: "2026-10-03T01:02:03Z", read_at: null }]} onLogout={vi.fn()} onNavigate={vi.fn()} onReadNotification={onRead} roleLabel="Quản trị hệ thống" />);
    fireEvent.click(screen.getByRole("button", { name: /Thông báo/i }));
    const time = screen.getByText(/08:02:03/);
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-10-03T01:02:03Z");
    expect(time).toHaveTextContent("03/10/2026");
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));
    expect(onRead).toHaveBeenCalledExactlyOnceWith("notice-1");
  });

  it("opens the active group, allows collapsing it and reopens it for a new destination", () => {
    const props = {
      navigation: [{ id: "operations", label: "Lịch & hoạt động", children: [{ id: "classes", label: "Lớp học" }, { id: "bookings", label: "Đặt chỗ" }] }],
      notifications: [], onNavigate: vi.fn(), onLogout: vi.fn(), onReadNotification: vi.fn(), roleLabel: "Quản lý",
    };
    const { rerender } = render(<AppShell {...props} currentView="classes" />);
    const group = screen.getByRole("button", { name: "Lịch & hoạt động, thu gọn" });
    expect(screen.getByRole("button", { name: "Lớp học" })).toHaveAttribute("aria-current", "page");
    expect(group).toHaveAttribute("aria-controls", "desktop-nav-operations");
    fireEvent.click(group);
    expect(screen.queryByRole("button", { name: "Lớp học" })).not.toBeInTheDocument();
    rerender(<AppShell {...props} currentView="bookings" />);
    fireEvent.click(screen.getByRole("button", { name: "Đặt chỗ" }));
    expect(props.onNavigate).toHaveBeenCalledWith("bookings");
  });

  it("moves focus into the modal menu, traps Tab and restores focus when closed", () => {
    renderShell();
    const trigger = screen.getByRole("button", { name: "Mở menu" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Điều hướng chính" });
    const close = within(dialog).getByRole("button", { name: "Đóng menu" });
    const logout = within(dialog).getByRole("button", { name: "Đăng xuất" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(close).toHaveFocus();
    expect(screen.getByRole("main", { hidden: true }).parentElement).toHaveAttribute("inert");

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(logout).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Điều hướng chính" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
