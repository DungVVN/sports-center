import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/api-error.js";
import { membershipApi } from "./membership-api.js";
import { MembershipsPage } from "./MembershipsPage.jsx";

vi.mock("./membership-api.js", () => ({
  membershipApi: {
    packages: vi.fn(),
    createPackage: vi.fn(),
    updatePackage: vi.fn(),
    create: vi.fn(),
    byMember: vi.fn(),
    mine: vi.fn(),
    requestFreeze: vi.fn(),
    freezeRequests: vi.fn(),
    reviewFreeze: vi.fn(),
    cancelPendingRenewal: vi.fn(),
  },
}));

const manager = { user: { role: "manager" }, permissions: ["membership.package.manage"] };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MembershipsPage mode="create" session={manager} /></QueryClientProvider>);
}

function fillValidPackage() {
  fireEvent.change(screen.getByPlaceholderText("Ví dụ: STANDARD"), { target: { value: "standard" } });
  fireEvent.change(screen.getByPlaceholderText("Ví dụ: Gói Tiêu chuẩn"), { target: { value: "Gói Tiêu chuẩn" } });
  const [price, , tierRank] = screen.getAllByRole("spinbutton");
  fireEvent.change(price, { target: { value: "490000" } });
  fireEvent.change(tierRank, { target: { value: "1" } });
}

describe("MembershipsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    membershipApi.packages.mockResolvedValue([]);
  });
  afterEach(cleanup);

  it("normalizes a valid package code before sending it", async () => {
    membershipApi.createPackage.mockResolvedValue({ id: "package-1" });
    renderPage();
    fillValidPackage();
    fireEvent.click(screen.getByRole("button", { name: "Tạo gói" }));
    await waitFor(() => expect(membershipApi.createPackage).toHaveBeenCalled());
    expect(membershipApi.createPackage.mock.calls[0][0]).toMatchObject({ code: "STANDARD", priceVnd: 490000, durationDays: 30, tierRank: 1 });
  });

  it("shows field details returned by backend validation", async () => {
    membershipApi.createPackage.mockRejectedValue(new ApiError({ code: "VALIDATION_ERROR", message: "Dữ liệu gửi lên chưa hợp lệ.", details: [{ path: "body.tierRank", message: "Expected number." }] }));
    renderPage();
    fillValidPackage();
    fireEvent.click(screen.getByRole("button", { name: "Tạo gói" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("tierRank: Expected number.");
  });
});
