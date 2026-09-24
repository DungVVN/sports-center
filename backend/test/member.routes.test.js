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
});
