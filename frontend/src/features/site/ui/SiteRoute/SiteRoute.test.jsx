import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManagedPublicPage } from "./SiteRoute.jsx";
import { publicSiteApi } from "../../api/site-public-api.js";
import { publicMembershipPackages } from "../../../memberships/index.js";
import { ApiError } from "../../../../shared/api/api-error.js";

vi.mock("../../api/site-public-api.js", () => ({ siteCmsPublicEnabled: false, publicSiteApi: { pageByPath: vi.fn(), menu: vi.fn() } }));
vi.mock("../../../memberships/index.js", () => ({ publicMembershipPackages: vi.fn() }));
vi.mock("../../../facilities/index.js", () => ({ FacilityCalendarPage: ({ embedded }) => <section aria-label="Lịch sân nghiệp vụ">{embedded ? <h2>Giờ trống & lịch đã đặt</h2> : <h1>Giờ trống & lịch đã đặt</h1>}</section> }));

const page = { title: "Bảng giá", seoTitle: "Bảng giá | Kinetic", seoDescription: "Giá gói đang mở bán", blocks: [{ id: "hero", type: "hero", active: true, title: "Bảng giá gói hội viên" }] };
function renderPage(path) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ManagedPublicPage path={path} onHomeClick={vi.fn()} onLoginClick={vi.fn()} onRegisterClick={vi.fn()} /></QueryClientProvider>);
}

describe("separate CMS public pages", () => {
  afterEach(cleanup);
  beforeEach(() => { vi.clearAllMocks(); publicSiteApi.pageByPath.mockResolvedValue(page); publicMembershipPackages.mockResolvedValue([{ code: "BASIC", name: "Basic", priceVnd: "490000", durationDays: 30, benefits: ["Phòng tập"] }]); });

  it.each(["/ve-chung-toi", "/dich-vu", "/bang-gia", "/lien-he", "/huong-dan-dang-ky-tap-luyen", "/gallery", "/calendar"])("loads the published page at %s while general CMS rollout is disabled", async (path) => {
    renderPage(path);
    expect(await screen.findByRole("heading", { name: "Bảng giá gói hội viên" })).toBeInTheDocument();
    expect(publicSiteApi.pageByPath).toHaveBeenCalledWith(path);
  });
  it("keeps the live calendar below CMS content without duplicating the page heading", async () => {
    const result = renderPage("/calendar");
    expect(await screen.findByRole("heading", { name: "Giờ trống & lịch đã đặt", level: 2 })).toBeInTheDocument();
    expect(result.container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("keeps pricing connected to package data and restores SEO on unmount", async () => {
    window.history.replaceState({}, "", "/bang-gia");
    const previousTitle = document.title;
    const result = renderPage("/bang-gia");
    expect(await screen.findByText("490.000")).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe(page.seoTitle));
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute("content", page.seoDescription);
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute("href", "https://kineticsports.io.vn/bang-gia");
    result.unmount();
    expect(document.title).toBe(previousTitle);
    window.history.replaceState({}, "", "/");
  });

  it("does not expose unpublished or unknown routes", async () => {
    publicSiteApi.pageByPath.mockRejectedValueOnce(new ApiError({ status: 404, code: "NOT_FOUND" }));
    renderPage("/unpublished");
    await screen.findByRole("heading", { name: /không tìm thấy/i });
    expect(publicSiteApi.pageByPath).toHaveBeenCalledWith("/unpublished");
    expect(screen.queryByRole("heading", { name: "Bảng giá gói hội viên" })).not.toBeInTheDocument();
  });

  it.each([
    new ApiError({ status: 503, code: "DATABASE_UNAVAILABLE", message: "Dữ liệu tạm thời gián đoạn." }),
    new ApiError({ code: "NETWORK_ERROR", message: "Không nhận được phản hồi từ API." }),
  ])("shows a retryable error instead of 404 when the API is unavailable", async (error) => {
    publicSiteApi.pageByPath.mockRejectedValueOnce(error).mockResolvedValueOnce(page);
    renderPage("/ve-chung-toi");
    expect(await screen.findByRole("heading", { name: "Không thể tải trang" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /không tìm thấy/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("heading", { name: "Bảng giá gói hội viên" })).toBeInTheDocument();
  });

  it("uses server-rendered published content immediately without another page request", () => {
    const script = document.createElement("script");
    script.id = "public-page-data";
    script.type = "application/json";
    script.textContent = JSON.stringify({ path: "/dich-vu", page });
    document.head.appendChild(script);
    try {
      renderPage("/dich-vu");
      expect(screen.getByRole("heading", { name: "Bảng giá gói hội viên" })).toBeInTheDocument();
      expect(publicSiteApi.pageByPath).not.toHaveBeenCalled();
    } finally { script.remove(); }
  });
});
