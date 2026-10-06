import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/database.js";
import { authRepository } from "../src/modules/auth/index.js";

vi.mock("../src/database.js", () => ({ prisma: {
  auth_sessions: { findUnique: vi.fn(), updateMany: vi.fn() },
  users: { findUnique: vi.fn() },
} }));

describe("session authentication query behavior", () => {
  const now = new Date("2026-10-06T09:00:00Z");
  const session = { id: "session-1", user_id: "user-1", revoked_at: null, expires_at: new Date("2026-10-06T10:00:00Z"), last_seen_at: new Date("2026-10-06T08:59:00Z") };
  beforeEach(() => {
    vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
    prisma.auth_sessions.findUnique.mockResolvedValue({ ...session });
    prisma.users.findUnique.mockResolvedValue({ id: "user-1", status: "active", role: "member" });
  });
  afterEach(() => vi.useRealTimers());

  it("avoids activity writes for frequently used sessions and does not read password hashes", async () => {
    await authRepository.findSessionUser("session-1", "user-1");
    await authRepository.findSessionUser("session-1", "user-1");
    expect(prisma.users.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.users.findUnique).toHaveBeenCalledWith({ where: { id: "user-1" }, select: {
      id: true, email: true, display_name: true, role: true, status: true, must_change_password: true, profile_setup_required: true,
    } });
    expect(prisma.auth_sessions.updateMany).not.toHaveBeenCalled();
  });

  it("touches old sessions conditionally so concurrent requests cannot repeatedly update them", async () => {
    prisma.auth_sessions.findUnique.mockResolvedValue({ ...session, last_seen_at: new Date("2026-10-06T08:54:00Z") });
    await authRepository.findSessionUser("session-1", "user-1");
    expect(prisma.auth_sessions.updateMany).toHaveBeenCalledWith({
      where: { id: "session-1", revoked_at: null, expires_at: { gt: now }, last_seen_at: { lte: new Date("2026-10-06T08:55:00Z") } },
      data: { last_seen_at: now },
    });
  });

  it.each([
    { revoked_at: now }, { expires_at: now }, { user_id: "another-user" },
  ])("rejects an invalid session without loading its user", async (invalid) => {
    prisma.auth_sessions.findUnique.mockResolvedValue({ ...session, ...invalid });
    await expect(authRepository.findSessionUser("session-1", "user-1")).resolves.toBeNull();
    expect(prisma.users.findUnique).not.toHaveBeenCalled();
    expect(prisma.auth_sessions.updateMany).not.toHaveBeenCalled();
  });

  it("observes account suspension and role changes on subsequent requests", async () => {
    const first = await authRepository.findSessionUser("session-1", "user-1");
    expect(first.user.role).toBe("member");
    prisma.users.findUnique.mockResolvedValueOnce({ id: "user-1", status: "active", role: "coach" }).mockResolvedValueOnce({ id: "user-1", status: "suspended" });
    expect((await authRepository.findSessionUser("session-1", "user-1")).user.role).toBe("coach");
    await expect(authRepository.findSessionUser("session-1", "user-1")).resolves.toBeNull();
    expect(prisma.auth_sessions.updateMany).not.toHaveBeenCalled();
  });
});
