import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SitePagesPage } from "./SitePagesPage.jsx";
import { siteAdminApi } from "../api/site-admin-api.js";

vi.mock("../api/site-admin-api.js", () => ({ siteAdminApi: {
  pages: vi.fn(), page: vi.fn(), savePageDraft: vi.fn(), publishPage: vi.fn(),
} }));

const draft = { id: "11111111-1111-4111-8111-111111111111", title: "Trang chủ", seo_title: "", seo_description: "", edit_revision: 1, blocks: [{ id: "22222222-2222-4222-8222-222222222222", type: "hero", active: true, title: "Tiêu đề cũ", eyebrow: "", description: "", imageUrl: "", buttonLabel: "", buttonHref: "" }] };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><SitePagesPage /></QueryClientProvider>);
}

describe("site pages admin draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    siteAdminApi.pages.mockResolvedValue([{ id: draft.id, route_key: "home", path: "/", kind: "home" }]);
    siteAdminApi.page.mockResolvedValue({ page: { path: "/" }, draft, published: null, revisions: [] });
    siteAdminApi.savePageDraft.mockResolvedValue({ ...draft, title: "Trang chủ mới", edit_revision: 2 });
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

  it("keeps the draft canvas before page settings in keyboard order without a hidden page sidebar", async () => {
    const { container } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Sửa trang Trang chủ" }));
    const title = await within(container).findByLabelText("Tiêu đề trang");
    const canvasHeading = within(container).getByText("BẢN XEM BỐ CỤC");
    expect(canvasHeading.compareDocumentPosition(title) & 4).toBeTruthy();
    expect(screen.queryByRole("complementary", { name: "Danh sách trang" })).not.toBeInTheDocument();
  });
});
