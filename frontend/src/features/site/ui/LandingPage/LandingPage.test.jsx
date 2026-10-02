import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "./LandingPage.jsx";
import { PublicPricingSection } from "../Pricing/PublicPricingSection.jsx";
import { publicMembershipPackages } from "../../../memberships/index.js";

vi.mock("../../../memberships/index.js", () => ({ publicMembershipPackages: vi.fn() }));
vi.mock("../../../courses/index.js", () => ({ courseApi: { publicCatalog: vi.fn().mockResolvedValue([]) } }));
vi.mock("../../../pt/index.js", () => ({ ptApi: { publicCatalog: vi.fn().mockResolvedValue([]) } }));

function renderPricing(onRegisterClick = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><PublicPricingSection onRegisterClick={onRegisterClick} /></QueryClientProvider>);
  return onRegisterClick;
}

describe("public membership pricing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows API prices and benefits, then opens account registration", async () => {
    publicMembershipPackages.mockResolvedValue([{ code: "BASIC", name: "Cơ bản", priceVnd: "490000", durationDays: 30, benefits: ["Tủ đồ tiêu chuẩn"] }]);
    const onRegisterClick = renderPricing();
    expect(await screen.findByText("490.000")).toBeInTheDocument();
    expect(screen.getByText("30 ngày sử dụng")).toBeInTheDocument();
    expect(screen.getByText("Tủ đồ tiêu chuẩn")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Tạo tài khoản" })[0]);
    expect(onRegisterClick).toHaveBeenCalledOnce();
  });

  it("shows an empty state without invented prices", async () => {
    publicMembershipPackages.mockResolvedValue([]);
    renderPricing();
    expect(await screen.findByText("Hiện chưa có gói hội viên được mở bán.")).toBeInTheDocument();
    expect(screen.queryByText("500.000đ")).not.toBeInTheDocument();
  });

  it("offers retry after a failed request", async () => {
    publicMembershipPackages.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
    renderPricing();
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa tải được bảng giá");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Hiện chưa có gói hội viên được mở bán.")).toBeInTheDocument();
  });
});

it("links to four separate pages without loading pricing on the homepage", () => {
  publicMembershipPackages.mockClear();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><LandingPage onLoginClick={vi.fn()} onRegisterClick={vi.fn()} /></QueryClientProvider>);
  for (const [name, path] of [["Về Chúng Tôi", "/ve-chung-toi"], ["Dịch Vụ", "/dich-vu"], ["Bảng Giá", "/bang-gia"], ["Liên Hệ", "/lien-he"]]) {
    expect(screen.getAllByRole("link", { name, exact: true })[0]).toHaveAttribute("href", path);
  }
  expect(publicMembershipPackages).not.toHaveBeenCalled();
});
