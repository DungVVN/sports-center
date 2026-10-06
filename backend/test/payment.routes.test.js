import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const memberId = "11111111-1111-4111-8111-111111111111";
const membershipId = "22222222-2222-4222-8222-222222222222";
const paymentId = "33333333-3333-4333-8333-333333333333";
function authService(permissions, role = "receptionist") { return { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "receptionist-1", role }, permissions }) }; }
function paymentService() { return { targets: vi.fn().mockResolvedValue([]), ownPayments: vi.fn().mockResolvedValue({ items: [], meta: { total: 0, page: 1, pageSize: 10 } }), ownReceipt: vi.fn().mockResolvedValue({ id: paymentId, events: [] }), page: vi.fn().mockResolvedValue({ items: [], meta: { total: 0, page: 1, pageSize: 10 } }), list: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: paymentId, status: "pending" }), get: vi.fn(), confirm: vi.fn().mockResolvedValue({ id: paymentId, status: "paid" }), providerCallback: vi.fn(), payosCallback: vi.fn().mockResolvedValue({ id: paymentId, status: "paid" }) }; }

describe("Payment routes", () => {
  it.each(["invalid", "", `${memberId}&memberId=${membershipId}`])("rejects malformed or repeated member filters before querying payments: %s", async (filter) => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.read"]), paymentService: service })).get(`/api/v1/payments?memberId=${filter}`).set("Authorization", "Bearer token").expect(422);
    expect(service.page).not.toHaveBeenCalled();
  });
  it("passes a validated optional member filter to the receipt list", async () => {
    const service = paymentService();
    const app = createApp({ authService: authService(["payment.read"]), paymentService: service });
    await request(app).get(`/api/v1/payments?memberId=${memberId}`).set("Authorization", "Bearer token").expect(200);
    expect(service.page).toHaveBeenLastCalledWith(expect.objectContaining({ memberId, page: 1, pageSize: 10 }));
    await request(app).get("/api/v1/payments").set("Authorization", "Bearer token").expect(200);
    expect(service.page).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 10 }));
  });
  it("lets a cashier load service targets using payment.record alone", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.record"]), paymentService: service })).get(`/api/v1/payments/targets?memberId=${memberId}`).set("Authorization", "Bearer token").expect(200);
    expect(service.targets).toHaveBeenCalledWith(memberId);
  });
  it("denies targets to receipt readers without collection permission", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.read"]), paymentService: service })).get(`/api/v1/payments/targets?memberId=${memberId}`).set("Authorization", "Bearer token").expect(403);
    expect(service.targets).not.toHaveBeenCalled();
  });
  it.each(["", "?memberId=invalid"])("validates the target member query %s", async (query) => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.record"]), paymentService: service })).get(`/api/v1/payments/targets${query}`).set("Authorization", "Bearer token").expect(422);
    expect(service.targets).not.toHaveBeenCalled();
  });
  it("lets a Member view their own payment statuses with payment.self.read", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.self.read"], "member"), paymentService: service })).get("/api/v1/members/me/payments").set("Authorization", "Bearer token").expect(200);
    expect(service.ownPayments).toHaveBeenCalledWith({ id: "receptionist-1", role: "member" }, { page: 1, pageSize: 10, search: "" });
  });
  it("creates a cash payment with its linked pending membership", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.record"]), paymentService: service })).post("/api/v1/payments").set("Authorization", "Bearer token")
      .send({ memberId, membershipId, amountVnd: 500000, method: "cash", notes: "Thu tại quầy" }).expect(201);
    expect(service.create).toHaveBeenCalledWith({ memberId, membershipId, amountVnd: 500000, method: "cash", notes: "Thu tại quầy" }, "receptionist-1");
  });

  it("requires a provider for an online payment", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.record"]), paymentService: service })).post("/api/v1/payments").set("Authorization", "Bearer token")
      .send({ memberId, amountVnd: 500000, method: "online" }).expect(422);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("accepts bank transfer creation without a payment provider", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.record"]), paymentService: service })).post("/api/v1/payments").set("Authorization", "Bearer token")
      .send({ memberId, amountVnd: 500000, method: "bank_transfer" }).expect(201);
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ method: "bank_transfer" }), "receptionist-1");
  });
  it("accepts PayOS as an online payment provider", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.record"]), paymentService: service })).post("/api/v1/payments").set("Authorization", "Bearer token")
      .send({ memberId, amountVnd: 500000, method: "online", provider: "payos" }).expect(201);
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ provider: "payos" }), "receptionist-1");
  });
  it.each(["vnpay", "momo", "zalopay"])("rejects unsupported provider %s", async (provider) => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.record"]), paymentService: service })).post("/api/v1/payments").set("Authorization", "Bearer token")
      .send({ memberId, amountVnd: 500000, method: "online", provider }).expect(422);
    expect(service.create).not.toHaveBeenCalled();
  });
  it("routes raw PayOS webhooks to the dedicated verifier before generic provider callbacks", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService([]), paymentService: service })).post("/api/v1/payments/callbacks/payos").send({ code: "00", data: {}, signature: "signature" }).expect(200);
    expect(service.payosCallback).toHaveBeenCalledWith({ code: "00", data: {}, signature: "signature" });
    expect(service.providerCallback).not.toHaveBeenCalled();
  });
  it("does not mount VNPAY sandbox or generic callback routes", async () => {
    const service = paymentService();
    const app = createApp({ authService: authService([]), paymentService: service });
    await request(app).get("/api/v1/payments/sandbox/vnpay/PAY-1234ABCD").expect(404);
    await request(app).post("/api/v1/payments/callbacks/vnpay").send({}).expect(404);
    expect(service.providerCallback).not.toHaveBeenCalled();
  });
  it("lets a Member view only a receipt addressed to their own account", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.self.read"], "member"), paymentService: service })).get(`/api/v1/members/me/payments/${paymentId}`).set("Authorization", "Bearer token").expect(200);
    expect(service.ownReceipt).toHaveBeenCalledWith(paymentId, { id: "receptionist-1", role: "member" });
  });

  it("allows receptionist confirmation only when payment.record exists", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.record"]), paymentService: service })).post(`/api/v1/payments/${paymentId}/confirm`).set("Authorization", "Bearer token").send({ status: "paid" }).expect(200);
    expect(service.confirm).toHaveBeenCalledWith(paymentId, "paid", "receptionist-1");
  });

  it("passes an optional reconciliation note to payment confirmation", async () => {
    const service = paymentService();
    await request(createApp({ authService: authService(["payment.record"]), paymentService: service })).post(`/api/v1/payments/${paymentId}/confirm`).set("Authorization", "Bearer token").send({ status: "paid", reconciliationNote: "Đã khớp sao kê ngân hàng" }).expect(200);
    expect(service.confirm).toHaveBeenCalledWith(paymentId, "paid", "receptionist-1", "Đã khớp sao kê ngân hàng");
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
    expect(service.page).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 10 }));
    expect(service.create).not.toHaveBeenCalled();
    expect(service.confirm).not.toHaveBeenCalled();
  });
});
