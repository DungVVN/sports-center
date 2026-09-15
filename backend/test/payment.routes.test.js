import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const memberId = "11111111-1111-4111-8111-111111111111";
const membershipId = "22222222-2222-4222-8222-222222222222";
const paymentId = "33333333-3333-4333-8333-333333333333";
function authService(permissions, role = "receptionist") { return { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "receptionist-1", role }, permissions }) }; }
function paymentService() { return { ownPayments: vi.fn().mockResolvedValue([]), list: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: paymentId, status: "pending" }), get: vi.fn(), confirm: vi.fn().mockResolvedValue({ id: paymentId, status: "paid" }), providerCallback: vi.fn() }; }

describe("Payment routes", () => {
  it("lets a Member view their own payment statuses without payment.record", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService([], "member"), paymentService: service })).get("/api/v1/members/me/payments").set("Authorization", "Bearer token").expect(200);
    expect(service.ownPayments).toHaveBeenCalledWith({ id: "receptionist-1", role: "member" });
  });
  it("creates a cash payment with its linked pending membership", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.record"]), paymentService: service })).post("/api/v1/payments").set("Authorization", "Bearer token")
      .send({ memberId, membershipId, amountVnd: 500000, method: "cash", notes: "Thu tại quầy" }).expect(201);
    expect(service.create).toHaveBeenCalledWith({ memberId, membershipId, amountVnd: 500000, method: "cash", notes: "Thu tại quầy" }, "receptionist-1");
  });

  it("rejects a payment method other than cash", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.record"]), paymentService: service })).post("/api/v1/payments").set("Authorization", "Bearer token")
      .send({ memberId, amountVnd: 500000, method: "online" }).expect(422);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("allows receptionist confirmation only when payment.record exists", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.record"]), paymentService: service })).post(`/api/v1/payments/${paymentId}/confirm`).set("Authorization", "Bearer token").send({ status: "paid" }).expect(200);
    expect(service.confirm).toHaveBeenCalledWith(paymentId, "paid", "receptionist-1");
  });

  it("blocks users without payment.read", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService([]), paymentService: service })).get("/api/v1/payments").set("Authorization", "Bearer token").expect(403);
    expect(service.list).not.toHaveBeenCalled();
  });

  it("lets a Manager view payments but not record or confirm them", async () => {
    const service = paymentService();
    const app = createApp({ authService: authService(["payment.read"], "manager"), paymentService: service });
    await request(app).get("/api/v1/payments").set("Authorization", "Bearer token").expect(200);
    await request(app).post("/api/v1/payments").set("Authorization", "Bearer token").send({ memberId, amountVnd: 500000, method: "cash" }).expect(403);
    await request(app).post(`/api/v1/payments/${paymentId}/confirm`).set("Authorization", "Bearer token").send({ status: "paid" }).expect(403);
    expect(service.list).toHaveBeenCalledWith(undefined);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.confirm).not.toHaveBeenCalled();
  });
});
