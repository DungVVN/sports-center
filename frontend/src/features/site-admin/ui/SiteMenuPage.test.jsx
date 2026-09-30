import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteMenuPage } from "./SiteMenuPage.jsx";
import { siteAdminApi } from "../api/site-admin-api.js";

vi.mock("../api/site-admin-api.js", () => ({ siteAdminApi: {
  menu: vi.fn(), saveMenuDraft: vi.fn(), publishMenu: vi.fn(),
} }));

describe("site menu admin draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    siteAdminApi.menu.mockResolvedValue({ draft: null, published: null, revisions: [] });
    siteAdminApi.saveMenuDraft.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", edit_revision: 1, items: [] });
  });

  it("keeps menu changes in draft until a separate publish action", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><SiteMenuPage /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm liên kết" }));
    expect(screen.getByRole("button", { name: /1\. Mục mới/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xuất bản" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
    await waitFor(() => expect(siteAdminApi.saveMenuDraft).toHaveBeenCalledWith("header", expect.objectContaining({ editRevision: 0, items: [expect.objectContaining({ label: "Mục mới" })] })));
    expect(siteAdminApi.publishMenu).not.toHaveBeenCalled();
  });
});
