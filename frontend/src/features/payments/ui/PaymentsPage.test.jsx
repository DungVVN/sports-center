import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/api/api-error.js";
import { memberApi } from "../../members/index.js";
import { paymentApi } from "../api/payment-api.js";
import { PaymentsPage } from "./PaymentsPage.jsx";

vi.mock("../../members/index.js", () => ({ memberApi: { list: vi.fn() } }));
vi.mock("../api/payment-api.js", () => ({ paymentApi: { targets: vi.fn(), list: vi.fn(), get: vi.fn(), create: vi.fn(), confirm: vi.fn() } }));

const cashier = { user: { role: "receptionist" }, permissions: ["payment.read", "payment.record"] };
const member = { id: "member-1", fullName: "Bình", memberCode: "HV-01" };
const membership = { id: "membership-1", targetField: "membershipId", name: "Gold", amountVnd: "500000" };

function renderPage(session = cashier) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PaymentsPage session={session} /></QueryClientProvider>);
}

describe("PaymentsPage", () => {
  it.each(["courseEnrollmentId", "ptPurchaseId", "facilityReservationId"])("links a cash receipt exclusively to %s", async (targetField) => {
    paymentApi.targets.mockResolvedValue([{ id: "service-1", targetField, name: "Dịch vụ QA", amountVnd: "250000" }]);
    paymentApi.create.mockResolvedValue({ id: "payment-1" });
    renderPage();
    await screen.findByRole("option", { name: /Bình/ });
    fireEvent.change(screen.getByLabelText("Hội viên"), { target: { value: member.id } });
    await screen.findByRole("option", { name: /Dịch vụ QA/ });
    fireEvent.change(screen.getByLabelText("Dịch vụ chờ thanh toán"), { target: { value: `${targetField}:service-1` } });
    expect(screen.getByLabelText("Số tiền (VNĐ)")).toHaveValue(250000);
    fireEvent.click(screen.getByRole("button", { name: "Lập phiếu thu" }));
    await waitFor(() => expect(paymentApi.create).toHaveBeenCalledWith({ memberId: member.id, [targetField]: "service-1", amountVnd: 250000, method: "cash", provider: undefined, notes: "" }));
  });

  it("clears the previous member's service and price while the next member loads", async () => {
    memberApi.list.mockResolvedValue([member, { id: "member-2", fullName: "An", memberCode: "HV-02" }]);
    paymentApi.targets.mockImplementation((id) => id === member.id ? Promise.resolve([membership]) : new Promise(() => {}));
    renderPage();
    await screen.findByRole("option", { name: /Bình/ });
    fireEvent.change(screen.getByLabelText("Hội viên"), { target: { value: member.id } });
    await screen.findByRole("option", { name: /Gold/ });
    fireEvent.change(screen.getByLabelText("Dịch vụ chờ thanh toán"), { target: { value: "membershipId:membership-1" } });
    fireEvent.change(screen.getByLabelText("Hội viên"), { target: { value: "member-2" } });
    expect(screen.getByLabelText("Số tiền (VNĐ)")).toHaveValue(null);
    expect(screen.getByLabelText("Dịch vụ chờ thanh toán")).toHaveValue("");
    expect(screen.queryByRole("option", { name: /Gold/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lập phiếu thu" })).toBeDisabled();
    expect(paymentApi.create).not.toHaveBeenCalled();
  });

  it("blocks collection when services fail to load and allows retry", async () => {
    paymentApi.targets.mockRejectedValue(new Error("offline"));
    renderPage();
    await screen.findByRole("option", { name: /Bình/ });
    fireEvent.change(screen.getByLabelText("Hội viên"), { target: { value: member.id } });
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Lập phiếu thu" })).toBeDisabled();
    paymentApi.targets.mockResolvedValue([membership]);
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    await screen.findByRole("option", { name: /Gold/ });
    expect(screen.getByRole("button", { name: "Lập phiếu thu" })).toBeEnabled();
  });

  it("does not silently turn an unavailable selected service into an unlinked receipt", async () => {
    renderPage();
    await screen.findByRole("option", { name: /Bình/ });
    fireEvent.change(screen.getByLabelText("Hội viên"), { target: { value: member.id } });
    await screen.findByRole("option", { name: /Gold/ });
    fireEvent.change(screen.getByLabelText("Dịch vụ chờ thanh toán"), { target: { value: "membershipId:membership-1" } });
    paymentApi.targets.mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    await screen.findByText("Dịch vụ không còn chờ thanh toán. Vui lòng tải lại và chọn lại.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Lập phiếu thu" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Lập phiếu thu" }));
    expect(paymentApi.create).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Dịch vụ không còn chờ thanh toán");
  });

  it("reports a paid service requiring review without claiming activation", async () => {
    paymentApi.list.mockResolvedValue([{ id: "payment-1", transaction_code: "PT-01", status: "pending", method: "cash", amountVnd: 500000, member }]);
    paymentApi.confirm.mockResolvedValue({ status: "paid", fulfillment_error: "PT_PAYMENT_NOT_ELIGIBLE" });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận đã thu" }));
    expect(await screen.findByText("Đã thu tiền nhưng dịch vụ cần đối soát trước khi kích hoạt.")).toBeInTheDocument();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    paymentApi.list.mockResolvedValue([]);
    memberApi.list.mockResolvedValue([member]);
    paymentApi.targets.mockResolvedValue([membership]);
  });
  afterEach(cleanup);

  it("lets a reader inspect a settled receipt without offering another collection", async () => {
    const paid = { id: "payment-1", transaction_code: "PAY-01", amountVnd: 500000, method: "cash", status: "paid", member, events: [{ id: "event-1", event_type: "receptionist_cash_confirmation", previous_status: "pending", new_status: "paid", occurred_at: "2026-10-03T01:00:00Z" }] };
    paymentApi.list.mockResolvedValue([paid]);
    paymentApi.get.mockResolvedValue(paid);
    renderPage({ user: { role: "receptionist" }, permissions: ["payment.read"] });
    fireEvent.click(await screen.findByRole("button", { name: "Xem biên lai" }));
    expect(await screen.findByRole("heading", { name: "Lịch sử thanh toán" })).toBeInTheDocument();
    expect(screen.getByText("Xác nhận phiếu thu tiền mặt")).toBeInTheDocument();
    expect(paymentApi.get).toHaveBeenCalledWith("payment-1");
    expect(screen.queryByRole("button", { name: "Xác nhận đã thu" })).not.toBeInTheDocument();
  });

  it("shows a retry action when a receipt cannot load", async () => {
    paymentApi.list.mockResolvedValue([{ id: "payment-1", transaction_code: "PAY-01", amountVnd: 1, status: "failed", method: "cash" }]);
    paymentApi.get.mockRejectedValue(new Error("offline"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Xem biên lai" }));
    expect(await screen.findByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the empty payment state", async () => {
    renderPage();
    expect(await screen.findByText("Chưa có giao dịch.")).toBeInTheDocument();
  });

  it("keeps recording controls hidden without payment.record", async () => {
    renderPage({ user: { role: "manager" }, permissions: ["payment.read"] });
    await screen.findByText("Chưa có giao dịch.");
    expect(screen.queryByText("Lập phiếu thu")).not.toBeInTheDocument();
    expect(memberApi.list).not.toHaveBeenCalled();
    expect(paymentApi.targets).not.toHaveBeenCalled();
  });

  it("creates an online payment and exposes its checkout link", async () => {
    paymentApi.create.mockResolvedValue({ checkoutUrl: "https://payments.example.test/checkout" });
    renderPage();
    await screen.findByText("Chưa có giao dịch.");
    await screen.findByRole("option", { name: /Bình/ });
    fireEvent.change(screen.getByLabelText("Hội viên"), { target: { value: "member-1" } });
    await screen.findByRole("option", { name: /Gold/ });
    fireEvent.change(screen.getByLabelText("Dịch vụ chờ thanh toán"), { target: { value: "membershipId:membership-1" } });
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
    fireEvent.change(screen.getByLabelText("Dịch vụ chờ thanh toán"), { target: { value: "membershipId:membership-1" } });
    fireEvent.change(screen.getByLabelText("Số tiền (VNĐ)"), { target: { value: "400000" } });
    expect(screen.getByText(/Số tiền phải khớp giá dịch vụ/)).toBeInTheDocument();
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
