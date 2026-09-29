import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog.jsx";

describe("Dialog", () => {
  afterEach(cleanup);

  it("closes through its labelled close action", async () => {
    const onClose = vi.fn();
    render(<Dialog isOpen onClose={onClose} title="Phân công Coach"><p>Nội dung</p></Dialog>);
    fireEvent.click(screen.getByRole("button", { name: "Đóng hộp thoại" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps keyboard focus inside and restores it to the trigger on Escape", () => {
    function Example() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)} type="button">Mở sửa</button><Dialog isOpen={open} onClose={() => setOpen(false)} title="Sửa dữ liệu"><input aria-label="Tên" /><button type="button">Lưu</button></Dialog></>;
    }
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Mở sửa" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Sửa dữ liệu" });
    const close = within(dialog).getByRole("button", { name: "Đóng hộp thoại" });
    const save = within(dialog).getByRole("button", { name: "Lưu" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(save).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Sửa dữ liệu" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
