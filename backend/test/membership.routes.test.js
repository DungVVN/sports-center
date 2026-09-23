import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const memberId = "11111111-1111-4111-8111-111111111111";
const packageId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";

function authService(permissions) { return { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "receptionist-1", role: "receptionist" }, permissions }) }; }
function membershipService() { return { createMemberMembership: vi.fn().mockResolvedValue({ id: membershipId, status: "pending_payment" }), createPackage: vi.fn().mockResolvedValue({ id: packageId, code: "BASIC" }), requestFreeze: vi.fn() }; }

describe("Member membership routes", () => {
  it("serves public package cards without a session", async () => {
    const service = { ...membershipService(), listPublicPackages: vi.fn().mockResolvedValue([{ code: "BASIC", name: "Cơ bản", priceVnd: "490000", durationDays: 30, benefits: ["Phòng tập"] }]) };
    const response = await request(createApp({ authService: authService([]), membershipService: service }))
      .get("/api/v1/public/membership-packages").expect(200);
    expect(response.body.data).toEqual([{ code: "BASIC", name: "Cơ bản", priceVnd: "490000", durationDays: 30, benefits: ["Phòng tập"] }]);
    expect(service.listPublicPackages).toHaveBeenCalledOnce();
  });

  it("creates a pending-payment membership with the authenticated actor", async () => {
    const service = membershipService();
    const response = await request(createApp({ authService: authService(["membership.assign"]), membershipService: service }))
      .post(`/api/v1/members/${memberId}/memberships`).set("Authorization", "Bearer token")
      .send({ packageId, startsOn: "2026-09-14" }).expect(201);
    expect(response.body.data).toMatchObject({ id: membershipId, status: "pending_payment" });
    expect(service.createMemberMembership).toHaveBeenCalledWith({ memberId, packageId, startsOn: "2026-09-14" }, "receptionist-1");
  });

  it("serializes bigint values returned by a successful service response", async () => {
    const service = membershipService();
    service.createMemberMembership.mockResolvedValue({ id: membershipId, priceVnd: 500000n, status: "pending_payment" });
    const response = await request(createApp({ authService: authService(["membership.assign"]), membershipService: service }))
      .post(`/api/v1/members/${memberId}/memberships`).set("Authorization", "Bearer token")
      .send({ packageId, startsOn: "2026-09-14" }).expect(201);
    expect(response.body.data.priceVnd).toBe("500000");
  });

  it("requires membership.assign to create a membership", async () => {
    const service = membershipService();
    await request(createApp({ authService: authService([]), membershipService: service })).post(`/api/v1/members/${memberId}/memberships`).set("Authorization", "Bearer token").send({ packageId, startsOn: "2026-09-14" }).expect(403);
    expect(service.createMemberMembership).not.toHaveBeenCalled();
  });

  it("rejects a malformed start date", async () => {
    const service = membershipService();
    await request(createApp({ authService: authService(["membership.assign"]), membershipService: service })).post(`/api/v1/members/${memberId}/memberships`).set("Authorization", "Bearer token").send({ packageId, startsOn: "14/09/2026" }).expect(422);
    expect(service.createMemberMembership).not.toHaveBeenCalled();
  });

  it("requires the dedicated package-management permission to create a package", async () => {
    const service = membershipService();
    const body = { code: "BASIC", name: "Gói cơ bản", priceVnd: 500000, durationDays: 30, tierRank: 1 };
    await request(createApp({ authService: authService(["member.write"]), membershipService: service })).post("/api/v1/membership-packages").set("Authorization", "Bearer token").send(body).expect(403);
    expect(service.createPackage).not.toHaveBeenCalled();
    await request(createApp({ authService: authService(["membership.package.manage"]), membershipService: service })).post("/api/v1/membership-packages").set("Authorization", "Bearer token").send(body).expect(201);
    expect(service.createPackage).toHaveBeenCalledWith(body, "receptionist-1");
  });

  it("requires the member-only freeze-request permission", async () => {
    const service = membershipService();
    await request(createApp({ authService: authService([]), membershipService: service }))
      .post(`/api/v1/memberships/${membershipId}/freeze-requests`)
      .set("Authorization", "Bearer token")
      .send({ startsOn: "2026-09-15", endsOn: "2026-09-20", reason: "Đi công tác" })
      .expect(403);
    expect(service.requestFreeze).not.toHaveBeenCalled();
  });
});
