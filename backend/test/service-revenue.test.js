import { describe, expect, it } from "vitest";
import { serviceRevenue } from "../src/modules/insights/domain/service-revenue.js";

describe("revenue by purchased service", () => {
  it("subtracts refunds in the execution period even when the receipt belongs to another period", () => {
    const result = serviceRevenue([], [{ amount_vnd: 500000n, payments: { course_enrollment_id: "course" } }]);
    expect(result.find((item) => item.type === "course")).toMatchObject({ grossVnd: "0", refundedVnd: "500000", amountVnd: "-500000", payments: 0 });
  });
  it("preserves large exact amounts and includes paid funds requiring fulfillment review", () => {
    const result = serviceRevenue([
      { membership_id: "m", amount_vnd: 500000n },
      { course_enrollment_id: "c", amount_vnd: 9007199254740993n },
      { pt_purchase_id: "p", amount_vnd: 100000n },
      { facility_reservation_id: "r", amount_vnd: 150000n, fulfillment_error: "FACILITY_PAYMENT_NOT_ELIGIBLE" },
      { amount_vnd: 10000n },
    ]);
    expect(result.find((item) => item.type === "course").amountVnd).toBe("9007199254740993");
    expect(result.find((item) => item.type === "facility")).toMatchObject({ amountVnd: "150000", payments: 1, requiresReview: 1 });
    expect(result.reduce((sum, item) => sum + BigInt(item.amountVnd), 0n)).toBe(9007199255500993n);
  });
});
