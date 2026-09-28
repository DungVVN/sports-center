import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/api-error.js";
import { memberApi } from "../members/member-api.js";
import { membershipApi } from "../memberships/membership-api.js";
import { paymentApi } from "./payment-api.js";
import { PaymentsPage } from "./PaymentsPage.jsx";

vi.mock("../members/member-api.js", () => ({ memberApi: { list: vi.fn() } }));
vi.mock("../memberships/membership-api.js", () => ({ membershipApi: { byMember: vi.fn() } }));
vi.mock("./payment-api.js", () => ({ paymentApi: { list: vi.fn(), create: vi.fn(), confirm: vi.fn() } }));

const cashier = { user: { role: "receptionist" }, permissions: ["payment.read", "payment.record"] };
const member = { id: "member-1", fullName: "Bình", memberCode: "HV-01" };
const membership = { id: "membership-1", status: "pending_payment", package_name_snapshot: "Gold", priceVnd: 500000 };

function renderPage(session = cashier) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PaymentsPage session={session} /></QueryClientProvider>);
}

describe("PaymentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentApi.list.mockResolvedValue([]);
    memberApi.list.mockResolvedValue([member]);
    membershipApi.byMember.mockResolvedValue([membership]);
  });
  afterEach(cleanup);

  it("shows the empty payment state", async () => {
    renderPage();
    expect(await screen.findByText("Chưa có giao dịch.")).toBeInTheDocument();
  });

  it("keeps recording controls hidden without payment.record", async () => {
    renderPage({ user: { role: "manager" }, permissions: ["payment.read"] });
    await screen.findByText("Chưa có giao dịch.");
    expect(screen.queryByText("Lập phiếu thu")).not.toBeInTheDocument();
    expect(memberApi.list).not.toHaveBeenCalled();
  });

  it("creates an online payment and exposes its checkout link", async () => {
    paymentApi.create.mockResolvedValue({ checkoutUrl: "https://payments.example.test/checkout" });
    renderPage();
    await screen.findByText("Chưa có giao dịch.");
    await screen.findByRole("option", { name: /Bình/ });
    fireEvent.change(screen.getByLabelText("Hội viên"), { target: { value: "member-1" } });
    await screen.findByRole("option", { name: /Gold/ });
    fireEvent.change(screen.getByLabelText("Gói chờ thanh toán"), { target: { value: "membership-1" } });
    fireEvent.change(screen.getByLabelText("Phương thức"), { target: { value: "online" } });
    fireEvent.click(screen.getByRole("button", { name: "Lập phiếu thu" }));
    await waitFor(() => expect(paymentApi.create).toHaveBeenCalledWith(expect.objectContaining({ memberId: "member-1", membershipId: "membership-1", amountVnd: 500000, method: "online" })));
    expect(await screen.findByRole("link", { name: "Mở trang thanh toán" })).toHaveAttribute("href", "https://payments.example.test/checkout");
  });

  it("shows an amount mismatch before submit and omits PayOS provider for cash", async () => {
    paymentApi.create.mockResolvedValue({ id: "payment-1" });
    renderPage();
    await screen.findByRole("option", { name: /Bình/ });
    fireEvent.change(screen.getByLabelText("Hội viên"), { target: { value: "member-1" } });
    await screen.findByRole("option", { name: /Gold/ });
    fireEvent.change(screen.getByLabelText("Gói chờ thanh toán"), { target: { value: "membership-1" } });
    fireEvent.change(screen.getByLabelText("Số tiền (VNĐ)"), { target: { value: "400000" } });
    expect(screen.getByText(/Số tiền phải khớp giá gói/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lập phiếu thu" }));
    expect(paymentApi.create).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Số tiền (VNĐ)"), { target: { value: "500000" } });
    fireEvent.click(screen.getByRole("button", { name: "Lập phiếu thu" }));
    await waitFor(() => expect(paymentApi.create).toHaveBeenCalledWith(expect.objectContaining({ method: "cash", provider: undefined, amountVnd: 500000 })));
  });

  it("shows the API 409 conflict after payment confirmation", async () => {
    paymentApi.list.mockResolvedValue([{ id: "payment-1", transaction_code: "PT-01", status: "pending", method: "cash", amountVnd: 500000, member, updated_at: new Date().toISOString() }]);
    paymentApi.confirm.mockRejectedValue(new ApiError({ status: 409, message: "Phiếu thu đã được xử lý." }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận đã thu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Phiếu thu đã được xử lý.");
  });
});
