import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/database.js";
import { authRepository } from "../src/modules/auth/index.js";

vi.mock("../src/database.js", () => ({ prisma: {
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  auth_mfa_login_challenges: { findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  auth_mfa_enrollments: { updateMany: vi.fn() },
  auth_totp_factors: { upsert: vi.fn(), findUnique: vi.fn() },
  users: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  members: { findMany: vi.fn() },
  auth_sessions: { updateMany: vi.fn(), create: vi.fn() },
  audit_logs: { create: vi.fn() },
  account_verifications: { updateMany: vi.fn(), findUnique: vi.fn() },
} }));

describe("MFA challenge consumption", () => {
  beforeEach(() => { vi.clearAllMocks(); prisma.$transaction.mockImplementation((callback) => callback(prisma)); });

  it("does not consume a challenge that expires between reading and updating", async () => {
    prisma.auth_mfa_login_challenges.findFirst.mockResolvedValue({ user_id: "user-1", expires_at: new Date(Date.now() + 60_000) });
    prisma.auth_mfa_login_challenges.updateMany.mockResolvedValue({ count: 0 });
    await expect(authRepository.consumeMfaLoginChallenge("challenge-1")).resolves.toBeNull();
    expect(prisma.auth_mfa_login_challenges.updateMany).toHaveBeenCalledWith({
      where: { id: "challenge-1", user_id: "user-1", used_at: null, expires_at: { gt: expect.any(Date) } },
      data: { used_at: expect.any(Date) },
    });
  });

  it("does not activate a factor from an expired or consumed enrollment", async () => {
    prisma.auth_mfa_enrollments.updateMany.mockResolvedValue({ count: 0 });
    await expect(authRepository.activateTotpFactor({ enrollmentId: "enrollment-1", userId: "user-1", secretCiphertext: "encrypted" })).resolves.toBeNull();
    expect(prisma.auth_totp_factors.upsert).not.toHaveBeenCalled();
    expect(prisma.auth_mfa_enrollments.updateMany).toHaveBeenCalledWith({
      where: { id: "enrollment-1", user_id: "user-1", consumed_at: null, expires_at: { gt: expect.any(Date) } },
      data: { consumed_at: expect.any(Date) },
    });
  });

  it("reads only approval fields rather than password hashes from the database", async () => {
    prisma.users.findMany.mockResolvedValue([{ id: "user-1" }]);
    prisma.members.findMany.mockResolvedValue([]);
    await authRepository.listPendingRegistrations();
    expect(prisma.users.findMany).toHaveBeenCalledWith({
      where: { role: "member", status: "pending_approval" },
      select: { id: true, email: true, display_name: true, role: true, status: true, created_at: true },
      orderBy: { created_at: "asc" },
    });
  });

  it("activates MFA, revokes sessions/challenges and records audit inside the same transaction", async () => {
    prisma.auth_mfa_enrollments.updateMany.mockResolvedValue({ count: 1 });
    prisma.auth_totp_factors.upsert.mockResolvedValue({ user_id: "user-1" });
    await expect(authRepository.activateTotpFactor({ enrollmentId: "enrollment-1", userId: "user-1", secretCiphertext: "encrypted" })).resolves.toEqual({ user_id: "user-1" });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.auth_sessions.updateMany).toHaveBeenCalledWith({ where: { user_id: "user-1", revoked_at: null }, data: { revoked_at: expect.any(Date) } });
    expect(prisma.auth_mfa_login_challenges.updateMany).toHaveBeenCalledWith({ where: { user_id: "user-1", expires_at: { gt: expect.any(Date) } }, data: { expires_at: expect.any(Date) } });
    expect(prisma.audit_logs.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "auth.mfa_enrolled", actor_user_id: "user-1" }) });
  });
});

describe("email verification concurrency guards", () => {
  beforeEach(() => { vi.resetAllMocks(); prisma.$transaction.mockImplementation((callback) => callback(prisma)); });

  it("reserves a code attempt only while below the limit and still active", async () => {
    prisma.account_verifications.updateMany.mockResolvedValue({ count: 0 });
    await expect(authRepository.incrementVerificationAttempts("verification-1")).resolves.toEqual({ count: 0 });
    expect(prisma.account_verifications.updateMany).toHaveBeenCalledWith({
      where: { id: "verification-1", verified_at: null, expires_at: { gt: expect.any(Date) }, attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
  });

  it("does not change an account after another request consumed the verification", async () => {
    prisma.account_verifications.updateMany.mockResolvedValue({ count: 0 });
    await expect(authRepository.completeRegistrationVerification({ verificationId: "verification-1", userId: "user-1", channel: "email" })).resolves.toBe(false);
    expect(prisma.users.updateMany).not.toHaveBeenCalled();
  });

  it("never downgrades an active or suspended account back to pending approval", async () => {
    prisma.account_verifications.updateMany.mockResolvedValue({ count: 1 });
    prisma.users.updateMany.mockResolvedValue({ count: 0 });
    await expect(authRepository.completeRegistrationVerification({ verificationId: "verification-1", userId: "user-1", channel: "email" })).rejects.toMatchObject({ code: "REGISTRATION_NOT_PENDING" });
    expect(prisma.users.updateMany).toHaveBeenCalledWith({ where: { id: "user-1", role: "member", status: "pending_verification" }, data: { status: "pending_approval" } });
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
  });
});

describe("password change transaction", () => {
  beforeEach(() => { vi.resetAllMocks(); prisma.$transaction.mockImplementation((callback) => callback(prisma)); });

  it.each([undefined, "current-session"])("revokes the required sessions and audits inside one transaction (%s)", async (currentSessionId) => {
    prisma.users.updateMany.mockResolvedValue({ count: 1 });
    await authRepository.changePasswordAndRevokeSessions({ userId: "user-1", passwordHash: "new-hash", expectedPasswordHash: "old-hash", currentSessionId });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.users.updateMany).toHaveBeenCalledWith({ where: { id: "user-1", status: "active", password_hash: "old-hash" }, data: { password_hash: "new-hash", must_change_password: false } });
    expect(prisma.auth_sessions.updateMany).toHaveBeenCalledWith({ where: { user_id: "user-1", ...(currentSessionId ? { id: { not: currentSessionId } } : {}), revoked_at: null }, data: { revoked_at: expect.any(Date) } });
    expect(prisma.auth_mfa_login_challenges.updateMany).toHaveBeenCalledWith({ where: { user_id: "user-1", expires_at: { gt: expect.any(Date) } }, data: { expires_at: expect.any(Date) } });
    expect(JSON.stringify(prisma.audit_logs.create.mock.calls)).not.toContain("hash");
  });

  it("rejects stale credentials before revoking sessions or auditing", async () => {
    prisma.users.updateMany.mockResolvedValue({ count: 0 });
    await expect(authRepository.changePasswordAndRevokeSessions({ userId: "user-1", passwordHash: "new", expectedPasswordHash: "old" })).rejects.toMatchObject({ statusCode: 409, code: "PASSWORD_CHANGE_CONFLICT" });
    expect(prisma.auth_sessions.updateMany).not.toHaveBeenCalled();
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
  });

  it("propagates a session-revocation failure out of the transaction", async () => {
    prisma.users.updateMany.mockResolvedValue({ count: 1 });
    prisma.auth_sessions.updateMany.mockRejectedValue(new Error("revocation failed"));
    await expect(authRepository.changePasswordAndRevokeSessions({ userId: "user-1", passwordHash: "new", expectedPasswordHash: "old" })).rejects.toThrow("revocation failed");
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
  });
});

describe("session issuance after credential changes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.users.findUnique.mockResolvedValue({ id: "user-1", status: "active", role: "member", password_hash: "new-hash" });
  });

  it("does not create a session if the password changed after the initial login check", async () => {
    await expect(authRepository.createSession({ userId: "user-1", expiresAt: new Date(Date.now() + 60000), expectedPasswordHash: "old-hash" })).rejects.toMatchObject({ statusCode: 401 });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.auth_sessions.create).not.toHaveBeenCalled();
  });

  it("rechecks expiry even when a MFA challenge was consumed before password reset", async () => {
    prisma.auth_mfa_login_challenges.findUnique.mockResolvedValue({ user_id: "user-1", used_at: new Date(), expires_at: new Date(Date.now() - 1000), login_surface: "main" });
    prisma.auth_totp_factors.findUnique.mockResolvedValue({ secret_ciphertext: "factor" });
    await expect(authRepository.createSession({ userId: "user-1", expiresAt: new Date(Date.now() + 60000), mfaChallengeId: "challenge-1", expectedFactorCiphertext: "factor" })).rejects.toMatchObject({ statusCode: 401 });
    expect(prisma.auth_sessions.create).not.toHaveBeenCalled();
  });

  it("rejects a verified email OTP invalidated by a password reset", async () => {
    prisma.users.findUnique.mockResolvedValue({ id: "user-1", role: "coach", status: "active" });
    prisma.account_verifications.findUnique.mockResolvedValue({ user_id: "user-1", purpose: "staff_login", verified_at: new Date(), expires_at: new Date(Date.now() - 1000) });
    await expect(authRepository.createSession({ userId: "user-1", expiresAt: new Date(Date.now() + 60000), emailVerificationId: "verification-1" })).rejects.toMatchObject({ statusCode: 401 });
    expect(prisma.auth_sessions.create).not.toHaveBeenCalled();
  });

  it("creates a valid session only after rechecking the current account", async () => {
    prisma.auth_sessions.create.mockResolvedValue({ id: "session-1" });
    await expect(authRepository.createSession({ userId: "user-1", expiresAt: new Date(Date.now() + 60000), expectedPasswordHash: "new-hash" })).resolves.toEqual({ id: "session-1" });
  });

  it("blocks password-only login if MFA was enabled after the password check", async () => {
    prisma.auth_totp_factors.findUnique.mockResolvedValue({ secret_ciphertext: "new-factor" });
    await expect(authRepository.createSession({ userId: "user-1", expiresAt: new Date(Date.now() + 60000), expectedPasswordHash: "new-hash" })).rejects.toMatchObject({ statusCode: 401 });
    expect(prisma.auth_sessions.create).not.toHaveBeenCalled();
  });

  it("does not issue a MFA challenge after a password reset", async () => {
    prisma.auth_totp_factors.findUnique.mockResolvedValue({ secret_ciphertext: "factor" });
    await expect(authRepository.createMfaLoginChallenge({ userId: "user-1", expiresAt: new Date(Date.now() + 60000), expectedPasswordHash: "old-hash", expectedFactorCiphertext: "factor" })).rejects.toMatchObject({ statusCode: 401 });
    expect(prisma.auth_mfa_login_challenges.create).not.toHaveBeenCalled();
  });

  it("issues a MFA challenge after checking the current password and factor", async () => {
    prisma.auth_totp_factors.findUnique.mockResolvedValue({ secret_ciphertext: "factor" });
    prisma.auth_mfa_login_challenges.create.mockResolvedValue({ id: "challenge-1" });
    await expect(authRepository.createMfaLoginChallenge({ userId: "user-1", expiresAt: new Date(Date.now() + 60000), expectedPasswordHash: "new-hash", expectedFactorCiphertext: "factor" })).resolves.toEqual({ id: "challenge-1" });
  });
});
