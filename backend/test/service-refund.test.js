import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createPaymentService } from "../src/modules/payments/index.js";
import { assertServiceRefundPayment } from "../src/modules/payments/domain/refund-policy.js";

describe("service refund finance boundaries", () => {
  it.each([
    { status: "pending", course_enrollment_id: "course" },
    { status: "refunded", pt_purchase_id: "pt" },
    { status: "paid", membership_id: "membership" },
    { status: "paid" },
  ])("keeps unpaid, refunded, membership and unrelated payments outside service refunds", (payment) => {
    expect(() => assertServiceRefundPayment(payment)).toThrow(expect.objectContaining({ code: "SERVICE_REFUND_NOT_ELIGIBLE" }));
  });

  it.each([
    ["requestRefund", "receptionist", ["payment", "Refund reason"]],
    ["reviewRefund", "receptionist", ["refund", true, "Review note"]],
    ["executeRefund", "manager", ["refund", "Transfer reference"]],
    ["reconcile", "member", ["payment", "Reconcile note"]],
  ])("denies %s to %s even if a permission is accidentally granted", async (action, role, args) => {
    const repository = { [action]: vi.fn() };
    await expect(createPaymentService({ repository })[action](...args, { id: "user", role })).rejects.toMatchObject({ statusCode: 403 });
    expect(repository[action]).not.toHaveBeenCalled();
  });

  it("requires proof before recording an actual refund", async () => {
    const service = { executeRefund: vi.fn() };
    const authService = { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "cashier", role: "receptionist" }, permissions: ["payment.refund.execute"] }) };
    await request(createApp({ authService, paymentService: service }))
      .post("/api/v1/service-refunds/11111111-1111-4111-8111-111111111111/execute")
      .set("Authorization", "Bearer test").send({ transferReference: "short" }).expect(422);
    expect(service.executeRefund).not.toHaveBeenCalled();
  });
});
