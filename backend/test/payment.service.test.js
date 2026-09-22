import { describe, expect, it, vi } from "vitest";
import { createPaymentService } from "../src/modules/payments/payment.service.js";

const memberId = "member-1";
const membershipId = "membership-1";
const input = { memberId, membershipId, amountVnd: 500000, method: "cash" };

function dependencies({ membership = { id: membershipId, member_id: memberId, status: "pending_payment", price_vnd_snapshot: 500000n } } = {}) {
  return {
    repository: { member: vi.fn().mockResolvedValue({ id: memberId }), membership: vi.fn().mockResolvedValue(membership), createWithEvent: vi.fn().mockResolvedValue({ id: "payment-1", transaction_code: "PAY-001", amount_vnd: 500000n }), payment: vi.fn(), paymentEvents: vi.fn().mockResolvedValue([]), memberByUser: vi.fn().mockResolvedValue({ id: memberId }), paymentByCode: vi.fn(), complete: vi.fn() },
    auditService: { record: vi.fn().mockResolvedValue(undefined) },
  };
}

describe("Payment service", () => {
  it("includes the paying member and linked membership in the receipt list", async () => {
    const { repository, auditService } = dependencies();
    repository.listWithDetails = vi.fn().mockResolvedValue([{
      id: "payment-1",
      amount_vnd: 500000n,
      member: { id: memberId, full_name: "Nguyễn Minh An", member_code: "MBR-001", phone: "0900000000", email: "an@example.test" },
      membership: { id: membershipId, package_name_snapshot: "Gói Tiêu chuẩn", status: "active", expires_on: new Date("2026-12-12") },
    }]);
    await expect(createPaymentService({ repository, auditService }).list()).resolves.toEqual([expect.objectContaining({ amountVnd: "500000", member: expect.objectContaining({ fullName: "Nguyễn Minh An" }), membership: expect.objectContaining({ packageName: "Gói Tiêu chuẩn", status: "active" }) })]);
  });

  it("rejects a client amount that differs from the membership price snapshot", async () => {
    const { repository, auditService } = dependencies();
    await expect(createPaymentService({ repository, auditService }).create({ ...input, amountVnd: 499000 }, "receptionist-1")).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_MISMATCH" });
    expect(repository.createWithEvent).not.toHaveBeenCalled();
  });

  it("creates payment and immutable creation event together", async () => {
    const { repository, auditService } = dependencies();
    await expect(createPaymentService({ repository, auditService }).create(input, "receptionist-1")).resolves.toMatchObject({ id: "payment-1", amountVnd: "500000" });
    expect(repository.createWithEvent).toHaveBeenCalledWith(expect.objectContaining({ amount_vnd: 500000n, membership_id: membershipId }), expect.objectContaining({ event_type: "payment_created", actor_user_id: "receptionist-1" }));
  });

  it("reports a concurrent confirmation without activating twice", async () => {
    const { repository, auditService } = dependencies();
    repository.payment.mockResolvedValue({ id: "payment-1", status: "pending", method: "cash", membership_id: membershipId, amount_vnd: 500000n }); repository.complete.mockResolvedValue(null);
    await expect(createPaymentService({ repository, auditService }).confirm("payment-1", "paid", "receptionist-1")).rejects.toMatchObject({ code: "PAYMENT_ALREADY_CONFIRMED" });
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it("shows a Member only their own immutable receipt events", async () => {
    const { repository, auditService } = dependencies();
    repository.listWithDetails = vi.fn().mockResolvedValue([{ id: "payment-1", amount_vnd: 500000n }]);
    repository.paymentEvents.mockResolvedValue([{ event_type: "payment_created" }]);
    const receipt = await createPaymentService({ repository, auditService }).ownReceipt("payment-1", { id: "user-1" });
    expect(repository.listWithDetails).toHaveBeenCalledWith({ id: "payment-1", member_id: memberId });
    expect(receipt.events).toEqual([{ event_type: "payment_created" }]);
  });

  it("creates an online sandbox payment only with a selected provider", async () => {
    const { repository, auditService } = dependencies();
    await expect(createPaymentService({ repository, auditService }).create({ ...input, method: "online", provider: "momo" }, "receptionist-1")).resolves.toMatchObject({ sandboxPaymentUrl: expect.stringContaining("/sandbox/momo/PAY-001") });
    expect(repository.createWithEvent).toHaveBeenCalledWith(expect.objectContaining({ method: "online", provider: "momo" }), expect.any(Object));
  });

  it("closes a pending PayOS payment if link creation fails", async () => {
    const { repository, auditService } = dependencies();
    const payosGateway = { createPaymentLink: vi.fn().mockRejectedValue(new Error("PayOS unavailable")), verifyWebhook: vi.fn() };
    await expect(createPaymentService({ repository, auditService, payosGateway }).create({ ...input, method: "online", provider: "payos" }, "receptionist-1")).rejects.toThrow("PayOS unavailable");
    expect(repository.complete).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", eventType: "payos_link_creation_failed" }));
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "payment.payos_link_failed" }));
  });
});
