import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

function makeService() {
  return {
    register: vi.fn().mockResolvedValue({ user: { id: "b7f2c76c-9c97-4d5a-91b8-936e2acff972" }, memberId: "17d813e0-a5e7-48e8-92bb-81fa123a8240", verifications: [] }),
    verifyRegistration: vi.fn().mockResolvedValue({ status: "pending_verification" }),
    resendVerification: vi.fn().mockResolvedValue({ channel: "email" }),
    login: vi.fn().mockResolvedValue({ token: "signed-token", expiresAt: new Date("2026-10-01T00:00:00.000Z"), user: { id: "b7f2c76c-9c97-4d5a-91b8-936e2acff972", role: "member" }, permissions: ["class.read"] }),
    beginTotpEnrollment: vi.fn().mockResolvedValue({ enrollmentId: "b7f2c76c-9c97-4d5a-91b8-936e2acff972", secret: "ABCD", otpauthUri: "otpauth://totp/example", expiresAt: new Date("2026-10-01T00:10:00.000Z") }),
    confirmTotpEnrollment: vi.fn().mockResolvedValue({ enrolled: true }),
    verifyMfaLogin: vi.fn().mockResolvedValue({ token: "mfa-signed-token", expiresAt: new Date("2026-10-01T00:00:00.000Z"), user: { id: "staff-1", role: "manager" }, permissions: ["staff.manage"] }),
    verifyStaffEmailOtp: vi.fn().mockResolvedValue({ token: "email-otp-signed-token", expiresAt: new Date("2026-10-01T00:00:00.000Z"), user: { id: "staff-1", role: "coach" }, permissions: ["class.read"] }),
    logout: vi.fn().mockResolvedValue(undefined),
    getAuthentication: vi.fn().mockResolvedValue({ user: { id: "staff-1", role: "receptionist" }, permissions: ["registration.approve"] }),
    getOwnProfile: vi.fn().mockResolvedValue({ id: "staff-1", fullName: "Lễ tân Hương", role: "receptionist" }),
    updateOwnProfile: vi.fn().mockResolvedValue({ id: "staff-1", fullName: "Lễ tân Hương", role: "receptionist" }),
    listPendingRegistrations: vi.fn().mockResolvedValue([]),
    approveRegistration: vi.fn().mockResolvedValue({ user: { id: "b7f2c76c-9c97-4d5a-91b8-936e2acff972" } }),
  };
}

describe("Auth routes", () => {
  it("validates public registration before invoking the service", async () => {
    const service = makeService();
    const response = await request(createApp({ authService: service })).post("/api/v1/auth/register").send({ email: "not-email" }).expect(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(service.register).not.toHaveBeenCalled();
  });

  it("registers a valid member", async () => {
    const service = makeService();
    const response = await request(createApp({ authService: service })).post("/api/v1/auth/register").send({ fullName: "Nguyễn Minh Anh", email: "anh@example.com", phone: "0901234567", password: "Strongpass1" }).expect(201);
    expect(response.body.success).toBe(true);
    expect(service.register).toHaveBeenCalledWith(expect.objectContaining({ email: "anh@example.com" }));
  });

  it("sets an HTTP-only session cookie on successful login", async () => {
    const service = makeService();
    const response = await request(createApp({ authService: service })).post("/api/v1/auth/login").send({ email: "anh@example.com", password: "Strongpass1" }).expect(200);
    expect(response.headers["set-cookie"][0]).toContain("sports_center_session=signed-token");
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).not.toMatch(/Expires=|Max-Age=/i);
    expect(response.body.data).not.toHaveProperty("token");
    expect(response.body.data.permissions).toEqual(["class.read"]);
  });

  it("does not create a session cookie before a required MFA challenge is completed", async () => {
    const service = makeService();
    service.login.mockResolvedValueOnce({ mfaRequired: true, mfaChallengeId: "b7f2c76c-9c97-4d5a-91b8-936e2acff972", expiresAt: new Date("2026-10-01T00:05:00.000Z") });
    const response = await request(createApp({ authService: service })).post("/api/v1/auth/login").send({ email: "manager@example.com", password: "Strongpass1" }).expect(200);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.body.data).toMatchObject({ mfaRequired: true, challengeId: "b7f2c76c-9c97-4d5a-91b8-936e2acff972" });
  });

  it("enrolls and completes a TOTP challenge through dedicated auth endpoints", async () => {
    const service = makeService();
    await request(createApp({ authService: service })).post("/api/v1/auth/mfa/totp/enrollment").set("Authorization", "Bearer session-token").expect(201);
    await request(createApp({ authService: service })).post("/api/v1/auth/mfa/totp/enrollment/confirm").set("Authorization", "Bearer session-token").send({ enrollmentId: "b7f2c76c-9c97-4d5a-91b8-936e2acff972", code: "123456" }).expect(200);
    const response = await request(createApp({ authService: service })).post("/api/v1/auth/mfa/totp/verify").send({ challengeId: "b7f2c76c-9c97-4d5a-91b8-936e2acff972", code: "123456" }).expect(200);
    expect(service.beginTotpEnrollment).toHaveBeenCalledWith({ userId: "staff-1" });
    expect(service.confirmTotpEnrollment).toHaveBeenCalledWith({ enrollmentId: "b7f2c76c-9c97-4d5a-91b8-936e2acff972", code: "123456", userId: "staff-1" });
    expect(service.verifyMfaLogin).toHaveBeenCalledWith({ challengeId: "b7f2c76c-9c97-4d5a-91b8-936e2acff972", code: "123456", loginSurface: "main" });
    expect(response.headers["set-cookie"][0]).toContain("sports_center_session=mfa-signed-token");
  });

  it("uses a separate Admin endpoint and passes the Admin login surface", async () => {
    const service = makeService();
    service.login.mockResolvedValueOnce({ token: "admin-token", expiresAt: new Date("2026-10-01T00:00:00.000Z"), user: { id: "admin-1", role: "admin" }, permissions: ["audit.read"] });
    await request(createApp({ authService: service })).post("/api/v1/auth/admin/login").send({ email: "admin@example.com", password: "Strongpass1" }).expect(200);
    await request(createApp({ authService: service })).post("/api/v1/auth/admin/mfa/totp/verify").send({ challengeId: "b7f2c76c-9c97-4d5a-91b8-936e2acff972", code: "123456" }).expect(200);
    expect(service.login).toHaveBeenCalledWith(expect.objectContaining({ email: "admin@example.com", loginSurface: "admin" }));
    expect(service.verifyMfaLogin).toHaveBeenCalledWith({ challengeId: "b7f2c76c-9c97-4d5a-91b8-936e2acff972", code: "123456", loginSurface: "admin" });
  });

  it("uses the authenticated permission for receptionist approval", async () => {
    const service = makeService();
    await request(createApp({ authService: service })).post("/api/v1/auth/registrations/b7f2c76c-9c97-4d5a-91b8-936e2acff972/approve").set("Authorization", "Bearer session-token").expect(200);
    expect(service.approveRegistration).toHaveBeenCalledWith({ approvedBy: "staff-1", userId: "b7f2c76c-9c97-4d5a-91b8-936e2acff972" });
  });

  it("lets an authenticated user read and update only their own profile", async () => {
    const service = makeService();
    await request(createApp({ authService: service })).get("/api/v1/auth/profile").set("Authorization", "Bearer session-token").expect(200);
    await request(createApp({ authService: service })).patch("/api/v1/auth/profile").set("Authorization", "Bearer session-token").send({ fullName: "Lễ tân Hương", phone: "0901000011", dateOfBirth: null }).expect(200);
    expect(service.getOwnProfile).toHaveBeenCalledWith("staff-1");
    expect(service.updateOwnProfile).toHaveBeenCalledWith({ userId: "staff-1", input: { fullName: "Lễ tân Hương", phone: "0901000011", dateOfBirth: null } });
  });
});
