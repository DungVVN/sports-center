import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthService } from "../src/modules/auth/index.js";
import { encryptTotpSecret } from "../src/shared/auth/totp.js";
import { createLoginAttemptLimiter } from "../src/shared/security/login-attempt-limiter.js";

const userId = "user-1";
function setup(role = "member", loginSurface = "main") {
  const repository = {
    findMfaLoginChallenge: vi.fn().mockImplementation(async (id) => ({ id, user_id: userId, login_surface: loginSurface, expires_at: new Date(119_000) })),
    findTotpFactor: vi.fn().mockResolvedValue({ secret_ciphertext: encryptTotpSecret("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ") }),
    consumeMfaLoginChallenge: vi.fn().mockResolvedValue({ id: "challenge" }),
    findUserById: vi.fn().mockResolvedValue({ id: userId, role, status: "active" }),
    createSession: vi.fn().mockResolvedValue({ id: "session-1" }),
    getPermissions: vi.fn().mockResolvedValue([]),
  };
  const service = createAuthService({ repository, verificationDelivery: {},
    loginLimiter: createLoginAttemptLimiter({ maxAttempts: 3, windowMinutes: 15 }),
  });
  return { repository, service };
}

describe("MFA login security", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(59_000); });
  afterEach(() => vi.useRealTimers());

  it("limits concurrent attempts across different challenges for the same account", async () => {
    const { service, repository } = setup();
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, index) => service.verifyMfaLogin({ challengeId: `challenge-${index}`, code: "287083" })));
    expect(results.filter((result) => result.reason?.code === "MFA_CODE_INVALID")).toHaveLength(3);
    expect(results.filter((result) => result.reason?.statusCode === 429)).toHaveLength(5);
    expect(repository.findTotpFactor).toHaveBeenCalledTimes(3);
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it("allows another attempt after the rate-limit window expires", async () => {
    const { service, repository } = setup();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(service.verifyMfaLogin({ challengeId: "challenge", code: "287083" })).rejects.toMatchObject({ code: "MFA_CODE_INVALID" });
    }
    await expect(service.verifyMfaLogin({ challengeId: "challenge", code: "287082" })).rejects.toMatchObject({ statusCode: 429 });
    vi.setSystemTime(59_000 + 15 * 60_000);
    repository.findMfaLoginChallenge.mockResolvedValue({ user_id: userId, login_surface: "main", expires_at: new Date(2_000_000) });
    await expect(service.verifyMfaLogin({ challengeId: "new", code: "287083" })).rejects.toMatchObject({ code: "MFA_CODE_INVALID" });
    expect(repository.findTotpFactor).toHaveBeenCalledTimes(4);
  });

  it("clears the MFA budget only after a successful login", async () => {
    const { service, repository } = setup();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(service.verifyMfaLogin({ challengeId: "challenge", code: "287083" })).rejects.toMatchObject({ code: "MFA_CODE_INVALID" });
    }
    await expect(service.verifyMfaLogin({ challengeId: "challenge", code: "287082" })).resolves.toMatchObject({ user: { id: userId } });
    await expect(service.verifyMfaLogin({ challengeId: "new", code: "287083" })).rejects.toMatchObject({ code: "MFA_CODE_INVALID" });
    expect(repository.createSession).toHaveBeenCalledTimes(1);
  });

  it("rejects expired challenges before checking secrets or creating a session", async () => {
    const { service, repository } = setup();
    repository.findMfaLoginChallenge.mockResolvedValue({ user_id: userId, expires_at: new Date(59_000) });
    await expect(service.verifyMfaLogin({ challengeId: "expired", code: "287082" })).rejects.toMatchObject({ code: "MFA_CHALLENGE_EXPIRED" });
    expect(repository.findTotpFactor).not.toHaveBeenCalled();
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it("limits enrollment confirmation attempts across enrollment ids", async () => {
    const { service, repository } = setup();
    repository.findMfaEnrollment = vi.fn().mockResolvedValue({ secret_ciphertext: encryptTotpSecret("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"), expires_at: new Date(119_000) });
    repository.activateTotpFactor = vi.fn();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(service.confirmTotpEnrollment({ enrollmentId: `enrollment-${attempt}`, userId, code: "287083" })).rejects.toMatchObject({ code: "MFA_CODE_INVALID" });
    }
    await expect(service.confirmTotpEnrollment({ enrollmentId: "another", userId, code: "287082" })).rejects.toMatchObject({ statusCode: 429 });
    expect(repository.activateTotpFactor).not.toHaveBeenCalled();
  });

  it("completes enrollment through the repository's atomic activation", async () => {
    const { service, repository } = setup();
    const secretCiphertext = encryptTotpSecret("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    repository.findMfaEnrollment = vi.fn().mockResolvedValue({ secret_ciphertext: secretCiphertext, expires_at: new Date(119_000) });
    repository.activateTotpFactor = vi.fn().mockResolvedValue({ user_id: userId });
    await expect(service.confirmTotpEnrollment({ enrollmentId: "enrollment-1", userId, code: "287082" })).resolves.toEqual({ enrolled: true });
    expect(repository.activateTotpFactor).toHaveBeenCalledWith({ enrollmentId: "enrollment-1", userId, secretCiphertext });
  });

  it.each([
    { role: "admin", surface: "main", code: "ADMIN_LOGIN_REQUIRED" },
    { role: "member", surface: "admin", code: "ADMIN_ACCOUNT_REQUIRED" },
  ])("rechecks the current $role role against the $surface portal", async ({ role, surface, code }) => {
    const { service, repository } = setup(role, surface);
    await expect(service.verifyMfaLogin({ challengeId: "challenge", code: "287082", loginSurface: surface })).rejects.toMatchObject({ code });
    expect(repository.createSession).not.toHaveBeenCalled();
  });
});
