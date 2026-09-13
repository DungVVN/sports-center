import { describe, expect, it, vi } from "vitest";
import { createAuthService } from "../src/modules/auth/auth.service.js";
import { createLoginAttemptLimiter } from "../src/shared/security/login-attempt-limiter.js";

describe("auth service login protection", () => {
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
});
