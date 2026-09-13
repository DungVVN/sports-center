import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog.jsx";

describe("Dialog", () => {
  it("closes through its labelled close action", async () => {
    const onClose = vi.fn();
    render(<Dialog isOpen onClose={onClose} title="Phân công Coach"><p>Nội dung</p></Dialog>);
    fireEvent.click(screen.getByRole("button", { name: "Đóng hộp thoại" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
