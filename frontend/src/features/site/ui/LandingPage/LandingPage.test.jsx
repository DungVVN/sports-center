import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "./LandingPage.jsx";
import { publicMembershipPackages } from "../../../memberships/index.js";

vi.mock("../../../memberships/index.js", () => ({ publicMembershipPackages: vi.fn() }));

function renderLanding(onRegisterClick = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><LandingPage onLoginClick={vi.fn()} onRegisterClick={onRegisterClick} /></QueryClientProvider>);
  return onRegisterClick;
}

describe("landing membership pricing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows API prices and benefits, then opens account registration", async () => {
    publicMembershipPackages.mockResolvedValue([{ code: "BASIC", name: "Cơ bản", priceVnd: "490000", durationDays: 30, benefits: ["Tủ đồ tiêu chuẩn"] }]);
    const onRegisterClick = renderLanding();
    expect(await screen.findByText("490.000")).toBeInTheDocument();
    expect(screen.getByText("30 ngày sử dụng")).toBeInTheDocument();
    expect(screen.getByText("Tủ đồ tiêu chuẩn")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Tạo tài khoản" })[0]);
    expect(onRegisterClick).toHaveBeenCalledOnce();
  });

  it("shows an empty state without invented prices", async () => {
    publicMembershipPackages.mockResolvedValue([]);
    renderLanding();
    expect(await screen.findByText("Hiện chưa có gói hội viên được mở bán.")).toBeInTheDocument();
    expect(screen.queryByText("500.000đ")).not.toBeInTheDocument();
  });

  it("offers retry after a failed request", async () => {
    publicMembershipPackages.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
    renderLanding();
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa tải được bảng giá");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Hiện chưa có gói hội viên được mở bán.")).toBeInTheDocument();
  });
});
