import { describe, expect, it, vi } from "vitest";
import { currentRuntime, withRuntime } from "../src/shared/runtime/request-context.js";
import { createLoginAttemptLimiter } from "../src/shared/security/login-attempt-limiter.js";
import { createDistributedLoginLimiter } from "../src/worker/login-limiter.js";

describe("Workers request isolation", () => {
  it("keeps concurrent request clients separate after asynchronous work", async () => {
    const results = await Promise.all(["first", "second"].map((database) => withRuntime({ database }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return currentRuntime().database;
    })));
    expect(results).toEqual(["first", "second"]);
    expect(currentRuntime()).toBeUndefined();
  });

  it("uses the distributed limiter inside Workers and the existing limiter outside", async () => {
    const distributed = { assertAllowed: vi.fn().mockRejectedValue(new Error("distributed rejection")) };
    const limiter = createLoginAttemptLimiter({ maxAttempts: 1, windowMinutes: 15 });
    await expect(withRuntime({ loginLimiter: distributed }, () => limiter.assertAllowed("member", 1))).rejects.toThrow("distributed rejection");
    limiter.recordFailure("member", 1);
    expect(() => limiter.assertAllowed("member", 2)).toThrow("Bạn đã đăng nhập sai quá nhiều lần");
  });

  it("fails closed on shared rate-limit rejection and uses a hashed identity", async () => {
    const remote = { allowed: vi.fn().mockResolvedValue(false), failure: vi.fn(), clear: vi.fn() };
    const binding = { idFromName: vi.fn((name) => name), get: vi.fn(() => remote) };
    const limiter = createDistributedLoginLimiter(binding, { maxAttempts: 5, windowMinutes: 15 });
    await expect(limiter.assertAllowed("member@example.com", 123)).rejects.toMatchObject({ statusCode: 429, code: "LOGIN_ATTEMPTS_EXCEEDED" });
    expect(binding.idFromName.mock.calls[0][0]).toMatch(/^[a-f0-9]{64}$/);
    expect(remote.allowed).toHaveBeenCalledWith(123, 5, 900000);
  });
});
