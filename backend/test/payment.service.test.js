import { describe, expect, it, vi } from "vitest";
import { createPaymentService } from "../src/modules/payments/payment.service.js";

const memberId = "member-1";
const membershipId = "membership-1";
const input = { memberId, membershipId, amountVnd: 500000, method: "cash" };

function dependencies({ membership = { id: membershipId, member_id: memberId, status: "pending_payment", price_vnd_snapshot: 500000n } } = {}) {
  return {
    repository: { member: vi.fn().mockResolvedValue({ id: memberId }), membership: vi.fn().mockResolvedValue(membership), createWithEvent: vi.fn().mockResolvedValue({ id: "payment-1", amount_vnd: 500000n }), payment: vi.fn(), complete: vi.fn() },
    auditService: { record: vi.fn().mockResolvedValue(undefined) },
  };
}

describe("Payment service", () => {
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
});
