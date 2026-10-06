import { afterEach, describe, expect, it, vi } from "vitest";

describe("production verification configuration", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it("fails closed when production would use development OTP delivery", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_JWT_SECRET", "test-only-auth-secret-at-least-32-characters");
    vi.stubEnv("VERIFICATION_CODE_SECRET", "test-only-otp-secret-at-least-32-characters");
    vi.stubEnv("AUTH_MFA_ENCRYPTION_KEY", "test-only-mfa-secret-at-least-32-characters");
    vi.stubEnv("VERIFICATION_DELIVERY_MODE", "development");
    await expect(import("../src/config/env.js")).rejects.toThrow("Production verification must use provider email delivery");
  });
});
