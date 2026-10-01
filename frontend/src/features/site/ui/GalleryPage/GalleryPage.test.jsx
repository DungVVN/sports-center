import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { GalleryPage } from "./GalleryPage.jsx";
vi.mock("../../api/site-public-api.js", () => ({ siteCmsPublicEnabled: false, publicSiteApi: { pageByPath: vi.fn().mockResolvedValue({ title: "Thư viện ảnh", blocks: [{ id: "gallery-hero", type: "hero", active: true, title: "Khám phá tập luyện" }] }) } }));

describe("GalleryPage navigation", () => {
  it("shows a body back button that opens the landing page", async () => {
    const onHomeClick = vi.fn();
    const onLoginClick = vi.fn();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(<QueryClientProvider client={client}><GalleryPage onHomeClick={onHomeClick} onLoginClick={onLoginClick} /></QueryClientProvider>);
    expect(await screen.findByRole("heading", { name: "Khám phá tập luyện" })).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: "Về Trang Chủ" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(onHomeClick).toHaveBeenCalledOnce();
    expect(container.querySelector('a[href="#"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Đăng Nhập" }));
    expect(onLoginClick).toHaveBeenCalledOnce();
    scrollTo.mockRestore();
  });
});
