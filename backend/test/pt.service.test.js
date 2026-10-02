import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createPtService } from "../src/modules/pt/index.js";
import { createApp } from "../src/app.js";
const actor = { id: "member-user", role: "member" };
const id = "11111111-1111-4111-8111-111111111111";
describe("PT ownership and permissions", () => {
  it("refuses to pay a different customer's purchase", async () => {
    const repository = { memberByUser: vi.fn().mockResolvedValue({ id: "mine" }), purchase: vi.fn().mockResolvedValue({ member_id: "other" }) };
    const paymentService = { create: vi.fn() };
    await expect(createPtService({ repository, paymentService }).payment(id, { method: "online" }, actor)).rejects.toMatchObject({ code: "PT_NOT_FOUND" });
    expect(paymentService.create).not.toHaveBeenCalled();
  });
  it("maps a DB schedule conflict into a useful PT error", async () => {
    const repository = { book: vi.fn().mockRejectedValue(new Error("Coach or room already has an overlapping class")) };
    await expect(createPtService({ repository }).book(id, {}, actor)).rejects.toMatchObject({ code: "PT_SCHEDULE_CONFLICT", statusCode: 422 });
  });
  it("does not let a purchaser record completion or assign a coach", async () => {
    const ptService = { complete: vi.fn(), assign: vi.fn() };
    const authService = { getAuthentication: vi.fn().mockResolvedValue({ user: actor, permissions: ["pt.read", "pt.purchase"] }) };
    const app = createApp({ authService, ptService });
    await request(app).post(`/api/v1/pt-appointments/${id}/complete`).set("Authorization", "Bearer test").send({ status: "completed", reason: "Tự ghi nhận" }).expect(403);
    await request(app).patch(`/api/v1/pt-purchases/${id}/coach`).set("Authorization", "Bearer test").send({ coachUserId: id }).expect(403);
    expect(ptService.complete).not.toHaveBeenCalled();
    expect(ptService.assign).not.toHaveBeenCalled();
  });
});
