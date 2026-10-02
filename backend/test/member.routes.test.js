import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

function authService(permissions = ["member.write"]) {
  return { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "receptionist-1", role: "receptionist" }, permissions }) };
}

describe("Member create route", () => {
  it("requires an email when the receptionist requests a member login", async () => {
    const memberService = { create: vi.fn() };

    await request(createApp({ authService: authService(), memberService }))
      .post("/api/v1/members")
      .set("Authorization", "Bearer token")
      .send({ fullName: "Nguyễn Văn An", phone: "0900000000", createAccount: true })
      .expect(422);

    expect(memberService.create).not.toHaveBeenCalled();
  });

  it("passes the login request to the member service", async () => {
    const memberService = { create: vi.fn().mockResolvedValue({ id: "member-1", accountCreated: true, credentialEmailDelivered: true }) };
    const body = { fullName: "Nguyễn Văn An", email: "an@example.com", phone: "0900000000", createAccount: true };

    await request(createApp({ authService: authService(), memberService }))
      .post("/api/v1/members")
      .set("Authorization", "Bearer token")
      .send(body)
      .expect(201);

    expect(memberService.create).toHaveBeenCalledWith({ ...body, contacts: [] }, "receptionist-1");
  });

  it("issues credentials only with the dedicated permission", async () => {
    const memberService = { issueAccountCredentials: vi.fn().mockResolvedValue({ accountCreated: true, credentialEmailDelivered: true }) };
    const memberId = "11111111-1111-4111-8111-111111111111";

    await request(createApp({ authService: authService(), memberService }))
      .post(`/api/v1/members/${memberId}/account-credentials`)
      .set("Authorization", "Bearer token")
      .expect(403);
    await request(createApp({ authService: authService(["member.credentials.reset"]), memberService }))
      .post(`/api/v1/members/${memberId}/account-credentials`)
      .set("Authorization", "Bearer token")
      .expect(200);

    expect(memberService.issueAccountCredentials).toHaveBeenCalledWith(memberId, "receptionist-1");
  });

  it("never lets a member reset another account even with a stale grant", async () => {
    const memberService = { issueAccountCredentials: vi.fn() };
    const auth = { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "member-actor", role: "member" }, permissions: ["member.credentials.reset"] }) };
    await request(createApp({ authService: auth, memberService }))
      .post("/api/v1/members/11111111-1111-4111-8111-111111111111/account-credentials")
      .set("Authorization", "Bearer token")
      .expect(403);
    expect(memberService.issueAccountCredentials).not.toHaveBeenCalled();
  });
});

describe("Member phone validation", () => {
  it("explains a short phone number before invoking the update service", async () => {
    const memberService = { update: vi.fn() };
    const authService = { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "staff-1", role: "receptionist" }, permissions: ["member.write"] }) };
    const response = await request(createApp({ memberService, authService })).patch("/api/v1/members/17d813e0-a5e7-48e8-92bb-81fa123a8240").set("Authorization", "Bearer session-token").send({ phone: "123" }).expect(422);
    expect(response.body.error.details).toContainEqual(expect.objectContaining({ path: "body.phone", message: expect.stringContaining("0901234567") }));
    expect(memberService.update).not.toHaveBeenCalled();
  });
});
