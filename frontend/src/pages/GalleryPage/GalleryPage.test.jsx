import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GalleryPage } from "./GalleryPage.jsx";

describe("GalleryPage navigation", () => {
  it("shows a body back button that opens the landing page", () => {
    const onHomeClick = vi.fn();
    const onLoginClick = vi.fn();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const { container } = render(<GalleryPage onHomeClick={onHomeClick} onLoginClick={onLoginClick} />);

    expect(screen.queryByRole("link", { name: "Về Trang Chủ" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(onHomeClick).toHaveBeenCalledOnce();
    expect(container.querySelector('a[href="#"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Đăng Nhập" }));
    expect(onLoginClick).toHaveBeenCalledOnce();
    scrollTo.mockRestore();
  });
});
