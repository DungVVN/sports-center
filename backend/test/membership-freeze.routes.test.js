import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const membershipId = "b7f2c76c-9c97-4d5a-91b8-936e2acff972";
const requestId = "17d813e0-a5e7-48e8-92bb-81fa123a8240";

function authService(permissions = []) { return { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "member-user", role: "member" }, permissions }) }; }
function membershipService() { return { listOwnMemberships: vi.fn().mockResolvedValue([]), requestFreeze: vi.fn().mockResolvedValue({ id: requestId }), freezeRequests: vi.fn().mockResolvedValue([]), reviewFreeze: vi.fn().mockResolvedValue({ id: requestId, status: "approved" }) }; }

describe("Membership self-service freeze routes", () => {
  it("lets a member with membership.freeze.request request freeze and passes server actor", async () => {
    const service = membershipService();
    await request(createApp({ authService: authService(["membership.freeze.request"]), membershipService: service })).post(`/api/v1/memberships/${membershipId}/freeze-requests`).set("Authorization", "Bearer token").send({ startsOn: "2026-10-01", endsOn: "2026-10-15", reason: "Đi công tác dài ngày" }).expect(201);
    expect(service.requestFreeze).toHaveBeenCalledWith(membershipId, expect.objectContaining({ startsOn: "2026-10-01" }), { id: "member-user", role: "member" });
  });

  it("keeps freeze review behind its exact permission", async () => {
    const service = membershipService();
    await request(createApp({ authService: authService(), membershipService: service })).patch(`/api/v1/membership-freeze-requests/${requestId}`).set("Authorization", "Bearer token").send({ approved: true }).expect(403);
    expect(service.reviewFreeze).not.toHaveBeenCalled();
  });

  it("shows only the authenticated member's memberships", async () => {
    const service = membershipService();
    await request(createApp({ authService: authService(["membership.self.read"]), membershipService: service })).get("/api/v1/members/me/memberships").set("Authorization", "Bearer token").expect(200);
    expect(service.listOwnMemberships).toHaveBeenCalledWith({ id: "member-user", role: "member" });
  });

  it("lists pending freeze requests only for a reviewer", async () => {
    const service = membershipService();
    const reviewerAuth = { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "receptionist-user", role: "receptionist" }, permissions: ["membership.freeze.review"] }) };
    await request(createApp({ authService: reviewerAuth, membershipService: service })).get("/api/v1/membership-freeze-requests?status=pending").set("Authorization", "Bearer token").expect(200);
    expect(service.freezeRequests).toHaveBeenCalledWith("pending");
  });
});
