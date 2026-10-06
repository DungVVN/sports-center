import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const authService = { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "staff", role: "manager" }, permissions: ["member.read", "payment.read"] }) };
describe("bounded server list queries", () => {
  it.each(["/members", "/payments"])("rejects oversized or invalid pages for %s before data access", async (path) => {
    const service = { page: vi.fn() };
    const app = createApp({ authService, memberService: service, paymentService: service });
    for (const query of ["pageSize=101", "page=0", "page=1.2", "page=1&page=2", "search=" + "a".repeat(121)]) {
      await request(app).get(`/api/v1${path}?${query}`).set("Authorization", "Bearer test").expect(422);
    }
    expect(service.page).not.toHaveBeenCalled();
  });
  it("preserves multi-select filters and returns pagination metadata", async () => {
    const memberService = { page: vi.fn().mockResolvedValue({ items: [{ id: "member" }], meta: { total: 21, page: 2, pageSize: 10, facets: { status: ["active", "frozen"] } } }) };
    const response = await request(createApp({ authService, memberService })).get("/api/v1/members?page=2&status=active&status=frozen&search=An").set("Authorization", "Bearer test").expect(200);
    expect(memberService.page).toHaveBeenCalledWith(expect.objectContaining({ page: 2, status: ["active", "frozen"], search: "An" }));
    expect(response.body.meta.total).toBe(21);
    expect(response.body.data).toEqual([{ id: "member" }]);
  });
  it("denies injecting another member into the personal payment scope", async () => {
    const paymentService = { ownPayments: vi.fn() };
    const memberAuth = { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "member", role: "member" }, permissions: ["payment.self.read"] }) };
    await request(createApp({ authService: memberAuth, paymentService })).get("/api/v1/members/me/payments?memberId=11111111-1111-4111-8111-111111111111").set("Authorization", "Bearer test").expect(422);
    expect(paymentService.ownPayments).not.toHaveBeenCalled();
  });
});
