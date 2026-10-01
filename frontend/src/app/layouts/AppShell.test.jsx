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
