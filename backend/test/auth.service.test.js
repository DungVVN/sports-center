import { describe, expect, it, vi } from "vitest";
import { createAuthService } from "../src/modules/auth/index.js";
import { createLoginAttemptLimiter } from "../src/shared/security/login-attempt-limiter.js";
import { hashPassword } from "../src/shared/auth/password.js";
import { hashVerificationCode } from "../src/shared/auth/session-token.js";

const acceptingCaptcha = { assertValid: vi.fn().mockResolvedValue(undefined) };

describe("auth service login protection", () => {
  it.each([
    { method: "verifyRegistration", input: { userId: "user-1", channel: "email", code: "123456" }, code: "VERIFICATION_ATTEMPTS_EXCEEDED" },
    { method: "verifyStaffEmailOtp", input: { challengeId: "verification-1", code: "123456" }, code: "EMAIL_OTP_ATTEMPTS_EXCEEDED" },
  ])("rejects $method when a concurrent request takes the final attempt", async ({ method, input, code }) => {
    const verification = { id: "verification-1", user_id: "user-1", attempts: 4, verified_at: null, expires_at: new Date(Date.now() + 60_000), code_hash: hashVerificationCode("123456") };
    const repository = { findLatestVerification: vi.fn().mockResolvedValue(verification), findVerification: vi.fn().mockResolvedValue(verification),
      incrementVerificationAttempts: vi.fn().mockResolvedValue({ count: 0 }), completeRegistrationVerification: vi.fn(), markVerificationVerifiedOnce: vi.fn(), createSession: vi.fn() };
    const service = createAuthService({ repository, verificationDelivery: {} });
    await expect(service[method](input)).rejects.toMatchObject({ statusCode: 429, code });
    expect(repository.completeRegistrationVerification).not.toHaveBeenCalled();
    expect(repository.markVerificationVerifiedOnce).not.toHaveBeenCalled();
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it("never exposes credential hashes or extra database fields in pending registrations", async () => {
    const createdAt = new Date("2026-10-01T00:00:00Z");
    const repository = { listPendingRegistrations: vi.fn().mockResolvedValue([
      { user: { id: "user-1", email: "member@example.com", display_name: "Member", role: "member", status: "pending_approval", created_at: createdAt, password_hash: "private-hash", future_secret: "private-secret" },
        member: { id: "member-1", member_code: "MBR-1", full_name: "Member", phone: "0901234567", private_notes: "private-notes" } },
      { user: { id: "user-2" }, member: null },
    ]) };
    const service = createAuthService({ repository, verificationDelivery: {} });
    const result = await service.listPendingRegistrations();
    expect(result[0]).toEqual({ user: { id: "user-1", email: "member@example.com", display_name: "Member", role: "member", status: "pending_approval", created_at: createdAt },
      member: { id: "member-1", member_code: "MBR-1", full_name: "Member", phone: "0901234567" } });
    expect(result[1].member).toBeNull();
    expect(JSON.stringify(result)).not.toContain("private-");
  });

  it("returns a conflict when a concurrent registration claims the same contact", async () => {
    const repository = {
      findUserByEmail: vi.fn().mockResolvedValue(null),
      findMemberByEmailOrPhone: vi.fn().mockResolvedValue(null),
      createRegistration: vi.fn().mockRejectedValue({ code: "P2002", meta: { target: ["email"] } }),
    };
    const service = createAuthService({ repository, verificationDelivery: { deliver: vi.fn() }, auditService: { record: vi.fn() }, captchaVerifier: acceptingCaptcha });
    await expect(service.register({ fullName: "Member", email: "member@example.com", phone: "0901234567", password: "Strongpass1" }))
      .rejects.toMatchObject({ statusCode: 409, code: "ACCOUNT_ALREADY_EXISTS" });
  });

  it("issues only an email code for a new member registration", async () => {
    const verificationDelivery = { deliver: vi.fn().mockResolvedValue({ delivered: true }) };
    const repository = {
      findUserByEmail: vi.fn().mockResolvedValue(null),
      findMemberByEmailOrPhone: vi.fn().mockResolvedValue(null),
      createRegistration: vi.fn().mockResolvedValue({ user: { id: "user-1", email: "member@example.com", display_name: "Member", role: "member", status: "pending_verification" }, member: { id: "member-1" } }),
      createVerification: vi.fn(),
    };
    const service = createAuthService({ repository, verificationDelivery, auditService: { record: vi.fn() }, captchaVerifier: acceptingCaptcha });

    await service.register({ fullName: "Member One", email: "MEMBER@example.com", phone: "0901234567", password: "Strongpass1" });

    expect(verificationDelivery.deliver).toHaveBeenCalledTimes(1);
    expect(verificationDelivery.deliver).toHaveBeenCalledWith(expect.objectContaining({ channel: "email", recipient: "member@example.com" }));
    expect(repository.createVerification).toHaveBeenCalledWith(expect.objectContaining({ channel: "email", userId: "user-1" }));
  });

  it("moves a member to approval after email verification", async () => {
    const code = "123456";
    const repository = {
      findLatestVerification: vi.fn().mockResolvedValue({ id: "verification-1", code_hash: hashVerificationCode(code), expires_at: new Date(Date.now() + 60_000), attempts: 0, verified_at: null }),
      incrementVerificationAttempts: vi.fn().mockResolvedValue({ count: 1 }),
      completeRegistrationVerification: vi.fn().mockResolvedValue(true),
    };
    const service = createAuthService({ repository, verificationDelivery: { deliver: vi.fn() }, auditService: { record: vi.fn() } });

    await expect(service.verifyRegistration({ channel: "email", code, userId: "user-1" })).resolves.toEqual({ status: "pending_approval" });
    expect(repository.completeRegistrationVerification).toHaveBeenCalledWith({ verificationId: "verification-1", userId: "user-1", channel: "email" });
  });
  it("limits repeated failed attempts and audits without storing credentials", async () => {
    const auditService = { record: vi.fn().mockResolvedValue(undefined) };
    const service = createAuthService({
      repository: { findUserByEmail: vi.fn().mockResolvedValue(null) },
      verificationDelivery: { send: vi.fn() },
      auditService,
      loginLimiter: createLoginAttemptLimiter({ maxAttempts: 3, windowMinutes: 15 }), captchaVerifier: acceptingCaptcha,
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(service.login({ email: "member@example.com", password: "incorrect-password" }))
        .rejects.toMatchObject({ code: "INVALID_CREDENTIALS", statusCode: 401 });
    }

    await expect(service.login({ email: "member@example.com", password: "incorrect-password" }))
      .rejects.toMatchObject({ code: "LOGIN_ATTEMPTS_EXCEEDED", statusCode: 429 });

    const entries = auditService.record.mock.calls.map(([entry]) => entry);
    expect(entries).toHaveLength(3);
    expect(entries.every((entry) => !("email" in entry) && !("password" in entry))).toBe(true);
  });

  it("changes password only after verifying the current password and revokes sessions", async () => {
    const repository = { userCredentials: vi.fn().mockResolvedValue({ id: "user-1", password_hash: await hashPassword("Current1") }), changePasswordAndRevokeSessions: vi.fn() };
    const auditService = { record: vi.fn() };
    const service = createAuthService({ repository, verificationDelivery: { send: vi.fn() }, auditService, captchaVerifier: acceptingCaptcha });
    await expect(service.changePassword({ userId: "user-1", currentPassword: "Current1", newPassword: "Updated2" })).resolves.toEqual({ mustChangePassword: false });
    expect(repository.changePasswordAndRevokeSessions).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", passwordHash: expect.any(String), expectedPasswordHash: expect.any(String), currentSessionId: undefined }));
  });

  it("keeps the current session after an initial password change", async () => {
    const repository = { userCredentials: vi.fn().mockResolvedValue({ id: "user-1", password_hash: await hashPassword("Current1"), must_change_password: true }), changePasswordAndRevokeSessions: vi.fn() };
    const service = createAuthService({ repository, verificationDelivery: { send: vi.fn() }, auditService: { record: vi.fn() }, captchaVerifier: acceptingCaptcha });

    await expect(service.changePassword({ userId: "user-1", currentSessionId: "session-1", currentPassword: "Current1", newPassword: "Updated2" })).resolves.toEqual({ mustChangePassword: false });
    expect(repository.changePasswordAndRevokeSessions).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", currentSessionId: "session-1" }));
  });

  it("returns current role permissions with a successful login", async () => {
    const repository = {
      findUserByEmail: vi.fn().mockResolvedValue({ id: "user-1", email: "manager@example.com", display_name: "Manager", role: "manager", status: "active", password_hash: await hashPassword("Strongpass1") }),
      createSession: vi.fn().mockResolvedValue({ id: "session-1" }),
      getPermissions: vi.fn().mockResolvedValue([{ permission_code: "training.template.manage" }]),
    };
    const service = createAuthService({ repository, verificationDelivery: { send: vi.fn() }, auditService: { record: vi.fn() }, captchaVerifier: acceptingCaptcha });

    await expect(service.login({ email: "MANAGER@example.com", password: "Strongpass1" })).resolves.toMatchObject({
      user: { id: "user-1", role: "manager" },
      permissions: ["training.template.manage"],
    });
    expect(repository.getPermissions).toHaveBeenCalledWith("manager");
  });

  it("returns the member first-profile flag without requiring another password change", async () => {
    const repository = {
      findUserByEmail: vi.fn().mockResolvedValue({ id: "member-1", email: "member@example.com", display_name: "Member", role: "member", status: "active", password_hash: await hashPassword("Strongpass1"), must_change_password: false, profile_setup_required: true }),
      createSession: vi.fn().mockResolvedValue({ id: "session-1" }),
      getPermissions: vi.fn().mockResolvedValue([]),
    };
    const service = createAuthService({ repository, verificationDelivery: { deliver: vi.fn() }, auditService: { record: vi.fn() }, captchaVerifier: acceptingCaptcha });
    await expect(service.login({ email: "member@example.com", password: "Strongpass1" })).resolves.toMatchObject({ user: { role: "member", mustChangePassword: false, profileSetupRequired: true } });
  });

  it("clears the first-profile flag only after a successful own-profile update", async () => {
    const profile = { user: { id: "staff-1", role: "coach", display_name: "Coach", email: "coach@example.com", status: "active", profile_setup_required: true }, staffProfile: { phone: "0901234567" }, contacts: [] };
    const repository = { findOwnProfile: vi.fn().mockResolvedValueOnce(profile).mockResolvedValueOnce({ ...profile, user: { ...profile.user, profile_setup_required: false } }), updateOwnProfile: vi.fn() };
    const service = createAuthService({ repository, verificationDelivery: { deliver: vi.fn() }, auditService: { record: vi.fn() } });
    await expect(service.updateOwnProfile({ userId: "staff-1", input: { fullName: "Coach Updated", phone: "0901234567" } })).resolves.toMatchObject({ profileSetupRequired: false });
    expect(repository.updateOwnProfile).toHaveBeenCalledWith("staff-1", { fullName: "Coach Updated", phone: "0901234567" });
  });

  it("returns a fixable conflict for a duplicate own-profile phone", async () => {
    const profile = { user: { id: "staff-1", role: "coach", display_name: "Coach", email: "coach@example.com", status: "active" }, staffProfile: { phone: "0901234567" }, contacts: [] };
    const repository = { findOwnProfile: vi.fn().mockResolvedValue(profile), updateOwnProfile: vi.fn().mockRejectedValue({ code: "P2002", meta: { target: ["phone"] } }) };
    const service = createAuthService({ repository, verificationDelivery: { deliver: vi.fn() }, auditService: { record: vi.fn() } });
    await expect(service.updateOwnProfile({ userId: "staff-1", input: { phone: "0911111111" } }))
      .rejects.toMatchObject({ statusCode: 409, code: "PROFILE_PHONE_EXISTS" });
  });

  it("separates the Admin login surface from the shared operational login", async () => {
    const repository = {
      findUserByEmail: vi.fn().mockResolvedValue({ id: "admin-1", email: "admin@example.com", display_name: "Admin", role: "admin", status: "active", password_hash: await hashPassword("Strongpass1") }),
      createSession: vi.fn().mockResolvedValue({ id: "admin-session-1" }),
      getPermissions: vi.fn().mockResolvedValue([{ permission_code: "audit.read" }]),
    };
    const service = createAuthService({ repository, verificationDelivery: { send: vi.fn() }, auditService: { record: vi.fn() }, captchaVerifier: acceptingCaptcha });
    await expect(service.login({ email: "admin@example.com", password: "Strongpass1", loginSurface: "main" })).rejects.toMatchObject({ code: "ADMIN_LOGIN_REQUIRED", statusCode: 403 });
    await expect(service.login({ email: "admin@example.com", password: "Strongpass1", loginSurface: "admin" })).resolves.toMatchObject({ user: { role: "admin" } });
  });

  it("creates a staff session directly when optional TOTP has not been enrolled", async () => {
    const repository = {
      findUserByEmail: vi.fn().mockResolvedValue({ id: "staff-1", email: "coach@example.com", display_name: "Coach", role: "coach", status: "active", password_hash: await hashPassword("Strongpass1") }),
      findTotpFactor: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockResolvedValue({ id: "session-1" }),
      getPermissions: vi.fn().mockResolvedValue([{ permission_code: "class.read" }]),
    };
    const service = createAuthService({ repository, verificationDelivery: { deliver: vi.fn() }, auditService: { record: vi.fn() }, captchaVerifier: acceptingCaptcha });

    await expect(service.login({ email: "COACH@example.com", password: "Strongpass1" })).resolves.toMatchObject({ user: { id: "staff-1", role: "coach" }, permissions: ["class.read"] });
    expect(repository.createSession).toHaveBeenCalledWith(expect.objectContaining({ userId: "staff-1" }));
    expect(repository.findTotpFactor).toHaveBeenCalledWith("staff-1");
  });

  it("requires a valid CAPTCHA token when CAPTCHA is enabled", async () => {
    const captchaVerifier = { assertValid: vi.fn().mockRejectedValue({ code: "CAPTCHA_REQUIRED" }) };
    const service = createAuthService({ repository: {}, verificationDelivery: { deliver: vi.fn() }, captchaVerifier });
    await expect(service.register({ fullName: "Member One", email: "member@example.com", phone: "0901234567", password: "Strongpass1" })).rejects.toMatchObject({ code: "CAPTCHA_REQUIRED" });
    expect(captchaVerifier.assertValid).toHaveBeenCalledWith(undefined);
  });

  it("creates a staff session only after a valid one-time email code", async () => {
    const code = "123456";
    const repository = {
      findVerification: vi.fn().mockResolvedValue({ id: "challenge-1", user_id: "staff-1", code_hash: hashVerificationCode(code), expires_at: new Date(Date.now() + 60_000), attempts: 0, verified_at: null }),
      incrementVerificationAttempts: vi.fn().mockResolvedValue({ count: 1 }),
      markVerificationVerifiedOnce: vi.fn().mockResolvedValue({ count: 1 }),
      findUserById: vi.fn().mockResolvedValue({ id: "staff-1", email: "coach@example.com", display_name: "Coach", role: "coach", status: "active" }),
      createSession: vi.fn().mockResolvedValue({ id: "session-1" }),
      getPermissions: vi.fn().mockResolvedValue([{ permission_code: "class.read" }]),
    };
    const service = createAuthService({ repository, verificationDelivery: { deliver: vi.fn() }, auditService: { record: vi.fn() }, captchaVerifier: acceptingCaptcha });

    await expect(service.verifyStaffEmailOtp({ challengeId: "challenge-1", code })).resolves.toMatchObject({ user: { id: "staff-1", role: "coach" }, permissions: ["class.read"] });
    expect(repository.markVerificationVerifiedOnce).toHaveBeenCalledWith("challenge-1");
    expect(repository.createSession).toHaveBeenCalledWith(expect.objectContaining({ userId: "staff-1" }));
  });
});
