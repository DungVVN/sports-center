import { describe, expect, it, vi } from "vitest";
import { createAuthService } from "../src/modules/auth/auth.service.js";
import { createLoginAttemptLimiter } from "../src/shared/security/login-attempt-limiter.js";
import { hashPassword } from "../src/shared/auth/password.js";
import { hashVerificationCode } from "../src/shared/auth/session-token.js";

describe("auth service login protection", () => {
  it("issues only an email code for a new member registration", async () => {
    const verificationDelivery = { deliver: vi.fn().mockResolvedValue({ delivered: true }) };
    const repository = {
      findUserByEmail: vi.fn().mockResolvedValue(null),
      findMemberByEmailOrPhone: vi.fn().mockResolvedValue(null),
      createRegistration: vi.fn().mockResolvedValue({ user: { id: "user-1", email: "member@example.com", display_name: "Member", role: "member", status: "pending_verification" }, member: { id: "member-1" } }),
      createVerification: vi.fn(),
    };
    const service = createAuthService({ repository, verificationDelivery, auditService: { record: vi.fn() } });

    await service.register({ fullName: "Member One", email: "MEMBER@example.com", phone: "0901234567", password: "Strongpass1" });

    expect(verificationDelivery.deliver).toHaveBeenCalledTimes(1);
    expect(verificationDelivery.deliver).toHaveBeenCalledWith(expect.objectContaining({ channel: "email", recipient: "member@example.com" }));
    expect(repository.createVerification).toHaveBeenCalledWith(expect.objectContaining({ channel: "email", userId: "user-1" }));
  });

  it("moves a member to approval after email verification", async () => {
    const code = "123456";
    const repository = {
      findLatestVerification: vi.fn().mockResolvedValue({ id: "verification-1", code_hash: hashVerificationCode(code), expires_at: new Date(Date.now() + 60_000), attempts: 0, verified_at: null }),
      incrementVerificationAttempts: vi.fn(),
      markVerificationVerified: vi.fn(),
      updateUserStatus: vi.fn(),
    };
    const service = createAuthService({ repository, verificationDelivery: { deliver: vi.fn() }, auditService: { record: vi.fn() } });

    await expect(service.verifyRegistration({ channel: "email", code, userId: "user-1" })).resolves.toEqual({ status: "pending_approval" });
    expect(repository.updateUserStatus).toHaveBeenCalledWith("user-1", "pending_approval");
  });
  it("limits repeated failed attempts and audits without storing credentials", async () => {
    const auditService = { record: vi.fn().mockResolvedValue(undefined) };
    const service = createAuthService({
      repository: { findUserByEmail: vi.fn().mockResolvedValue(null) },
      verificationDelivery: { send: vi.fn() },
      auditService,
      loginLimiter: createLoginAttemptLimiter({ maxAttempts: 3, windowMinutes: 15 }),
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
    const repository = { userCredentials: vi.fn().mockResolvedValue({ id: "user-1", password_hash: await hashPassword("Current1") }), updatePassword: vi.fn(), revokeUserSessions: vi.fn() };
    const auditService = { record: vi.fn() };
    const service = createAuthService({ repository, verificationDelivery: { send: vi.fn() }, auditService });
    await expect(service.changePassword({ userId: "user-1", currentPassword: "Current1", newPassword: "Updated2" })).resolves.toBeUndefined();
    expect(repository.updatePassword).toHaveBeenCalled();
    expect(repository.revokeUserSessions).toHaveBeenCalledWith("user-1");
  });

  it("returns current role permissions with a successful login", async () => {
    const repository = {
      findUserByEmail: vi.fn().mockResolvedValue({ id: "user-1", email: "manager@example.com", display_name: "Manager", role: "manager", status: "active", password_hash: await hashPassword("Strongpass1") }),
      createSession: vi.fn().mockResolvedValue({ id: "session-1" }),
      getPermissions: vi.fn().mockResolvedValue([{ permission_code: "training.template.manage" }]),
    };
    const service = createAuthService({ repository, verificationDelivery: { send: vi.fn() }, auditService: { record: vi.fn() } });

    await expect(service.login({ email: "MANAGER@example.com", password: "Strongpass1" })).resolves.toMatchObject({
      user: { id: "user-1", role: "manager" },
      permissions: ["training.template.manage"],
    });
    expect(repository.getPermissions).toHaveBeenCalledWith("manager");
  });
});
