import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SitePagesPage } from "./SitePagesPage.jsx";
import { siteAdminApi } from "../api/site-admin-api.js";

vi.mock("../api/site-admin-api.js", () => ({ siteAdminApi: {
  pages: vi.fn(), page: vi.fn(), savePageDraft: vi.fn(), publishPage: vi.fn(), deletePage: vi.fn(),
} }));

const draft = { id: "11111111-1111-4111-8111-111111111111", title: "Trang chủ", seo_title: "", seo_description: "", edit_revision: 1, blocks: [{ id: "22222222-2222-4222-8222-222222222222", type: "hero", active: true, title: "Tiêu đề cũ", eyebrow: "", description: "", imageUrl: "", buttonLabel: "", buttonHref: "" }] };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><SitePagesPage /></QueryClientProvider>);
}

describe("site pages admin draft", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    siteAdminApi.pages.mockResolvedValue([{ id: draft.id, route_key: "home", path: "/", kind: "home" }]);
    siteAdminApi.page.mockResolvedValue({ page: { path: "/" }, draft, published: null, revisions: [] });
    siteAdminApi.savePageDraft.mockResolvedValue({ ...draft, title: "Trang chủ mới", edit_revision: 2 });
  });

  it("protects integrated pages from deletion", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "Xóa trang Trang chủ" })).toBeDisabled();
    expect(siteAdminApi.deletePage).not.toHaveBeenCalled();
  });

  it("allows cancellation before deleting a page", async () => {
    siteAdminApi.pages.mockResolvedValue([{ id: "about", route_key: "about", path: "/about", title: "Giới thiệu" }]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Xóa trang Giới thiệu" }));
    expect(siteAdminApi.deletePage).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog", { name: "Xóa trang website" })).getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(siteAdminApi.deletePage).not.toHaveBeenCalled();
  });

  it("refreshes the catalog only after confirmed deletion", async () => {
    siteAdminApi.pages.mockResolvedValue([{ id: "about", route_key: "about", path: "/about", title: "Giới thiệu" }]);
    siteAdminApi.deletePage.mockImplementation(async () => {
      siteAdminApi.pages.mockResolvedValue([]);
      return { routeKey: "about", deleted: true };
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Xóa trang Giới thiệu" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Xóa trang website" })).getByRole("button", { name: "Xác nhận xóa" }));
    await waitFor(() => expect(siteAdminApi.deletePage).toHaveBeenCalledExactlyOnceWith("about"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Xóa trang Giới thiệu" })).not.toBeInTheDocument());
    expect(screen.getByText("Đã xóa trang khỏi danh mục và website.")).toBeInTheDocument();
  });

  it("keeps the page and displays deletion errors in the confirmation dialog", async () => {
    siteAdminApi.pages.mockResolvedValue([{ id: "about", route_key: "about", path: "/about", title: "Giới thiệu" }]);
    siteAdminApi.deletePage.mockRejectedValue(new Error("Trang còn được sử dụng trong menu."));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Xóa trang Giới thiệu" }));
    const dialog = screen.getByRole("dialog", { name: "Xóa trang website" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận xóa" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Trang còn được sử dụng trong menu.");
    expect(screen.getByRole("button", { name: "Xóa trang Giới thiệu" })).toBeInTheDocument();
  });

  it("saves a draft without publishing and disables publish while changes are unsaved", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Sửa trang Trang chủ" }));
    const title = await screen.findByLabelText("Tiêu đề trang");
    fireEvent.change(title, { target: { value: "Trang chủ mới" } });
    expect(screen.getByRole("button", { name: "Xuất bản" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
    await waitFor(() => expect(siteAdminApi.savePageDraft).toHaveBeenCalledWith("home", expect.objectContaining({ title: "Trang chủ mới", editRevision: 1 })));
    expect(siteAdminApi.publishPage).not.toHaveBeenCalled();
  });

  it("adds a supported block through the library and previews it in the draft canvas", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Sửa trang Trang chủ" }));
    await screen.findByLabelText("Tiêu đề trang");
    fireEvent.click(screen.getByRole("button", { name: "+ Thêm phần" }));
    expect(screen.getByRole("dialog", { name: "Thêm phần vào trang" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Câu hỏi thường gặp/ }));
    expect(screen.getByText("2 phần trên trang")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xuất bản" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
    await waitFor(() => expect(siteAdminApi.savePageDraft).toHaveBeenCalledWith("home", expect.objectContaining({ blocks: expect.arrayContaining([expect.objectContaining({ type: "faq" })]) })));
  });

  it("keeps the page unpublished when the publish dialog is cancelled", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Sửa trang Trang chủ" }));
    await screen.findByLabelText("Tiêu đề trang");
    fireEvent.click(screen.getByRole("button", { name: "Xuất bản", exact: true }));
    const dialog = screen.getByRole("dialog", { name: "Xuất bản trang" });
    expect(siteAdminApi.publishPage).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("dialog", { name: "Xuất bản trang" })).not.toBeInTheDocument();
    expect(siteAdminApi.publishPage).not.toHaveBeenCalled();
  });

  it("publishes the saved revision only after explicit dialog confirmation", async () => {
    siteAdminApi.publishPage.mockImplementation(async () => {
      siteAdminApi.page.mockResolvedValue({ page: { path: "/" }, draft: null, published: draft, revisions: [] });
      return draft;
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Sửa trang Trang chủ" }));
    await screen.findByLabelText("Tiêu đề trang");
    fireEvent.click(screen.getByRole("button", { name: "Xuất bản", exact: true }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Xuất bản trang" })).getByRole("button", { name: "Xác nhận xuất bản" }));
    await waitFor(() => expect(siteAdminApi.publishPage).toHaveBeenCalledExactlyOnceWith("home", 1));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Xuất bản trang" })).not.toBeInTheDocument());
    expect(screen.getByText("Đã xuất bản trang.")).toBeInTheDocument();
  });

  it("keeps the draft canvas before page settings in keyboard order without a hidden page sidebar", async () => {
    const { container } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Sửa trang Trang chủ" }));
    const title = await within(container).findByLabelText("Tiêu đề trang");
    const canvasHeading = within(container).getByText("BẢN XEM BỐ CỤC");
    expect(canvasHeading.compareDocumentPosition(title) & 4).toBeTruthy();
    expect(screen.queryByRole("complementary", { name: "Danh sách trang" })).not.toBeInTheDocument();
  });
});
