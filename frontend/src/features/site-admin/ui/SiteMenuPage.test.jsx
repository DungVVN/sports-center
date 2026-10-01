import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteMenuPage } from "./SiteMenuPage.jsx";
import { siteAdminApi } from "../api/site-admin-api.js";

vi.mock("../api/site-admin-api.js", () => ({ siteAdminApi: {
  menu: vi.fn(), saveMenuDraft: vi.fn(), publishMenu: vi.fn(),
} }));

describe("site menu admin draft", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    siteAdminApi.menu.mockResolvedValue({ draft: null, published: null, revisions: [] });
    siteAdminApi.saveMenuDraft.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", edit_revision: 1, items: [] });
  });

  it("keeps menu changes in draft until a separate publish action", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><SiteMenuPage /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "+ Thêm mục cấp 1" }));
    expect(screen.getByRole("button", { name: "Chỉnh sửa Mục mới" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xuất bản" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
    await waitFor(() => expect(siteAdminApi.saveMenuDraft).toHaveBeenCalledWith("header", expect.objectContaining({ editRevision: 0, items: [expect.objectContaining({ label: "Mục mới" })] })));
    expect(siteAdminApi.publishMenu).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation and lets the admin cancel publishing", async () => {
    siteAdminApi.menu.mockResolvedValue({ draft: { id: "draft", edit_revision: 1, items: [{ id: "home", label: "Trang chủ", kind: "link", href: "/", active: true, children: [] }] }, published: null, revisions: [] });
    siteAdminApi.publishMenu.mockResolvedValue({ id: "published" });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><SiteMenuPage /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Xuất bản", exact: true })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Xuất bản", exact: true }));
    expect(siteAdminApi.publishMenu).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Hủy", exact: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xuất bản", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận xuất bản" }));
    await waitFor(() => expect(siteAdminApi.publishMenu).toHaveBeenCalledWith("header", 1));
  });
});
