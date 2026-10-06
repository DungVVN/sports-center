import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ DurableObject: class { constructor(ctx) { this.ctx = ctx; } } }));
const { LoginAttempts } = await import("../src/worker/login-attempts.js");

describe("Worker MFA attempt reservation", () => {
  it("reserves and rejects attempts in storage transactions, then expires old attempts", async () => {
    let attempts = [];
    const storage = {
      get: vi.fn(async () => [...attempts]),
      put: vi.fn(async (_key, value) => { attempts = value; }),
      transaction: vi.fn(async (callback) => callback(storage)),
      setAlarm: vi.fn(),
    };
    const limiter = new LoginAttempts({ storage });
    expect(await limiter.consume(1, 2, 100)).toBe(true);
    expect(await limiter.consume(2, 2, 100)).toBe(true);
    expect(await limiter.consume(3, 2, 100)).toBe(false);
    expect(attempts).toEqual([1, 2]);
    expect(await limiter.consume(102, 2, 100)).toBe(true);
    expect(attempts).toEqual([102]);
    expect(storage.transaction).toHaveBeenCalledTimes(4);
    expect(storage.setAlarm).toHaveBeenLastCalledWith(202);
  });
});
