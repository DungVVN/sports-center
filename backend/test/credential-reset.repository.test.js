import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  $transaction: vi.fn(),
  members: { findUnique: vi.fn() },
  users: { update: vi.fn() },
  auth_sessions: { updateMany: vi.fn() },
};
vi.mock("../src/database.js", () => ({ prisma }));

const { memberRepository } = await import("../src/modules/members/member.repository.js");
const { staffRepository } = await import("../src/modules/staff/staff.repository.js");

describe("credential reset session revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });

  it("revokes all existing member sessions when reissuing credentials", async () => {
    prisma.members.findUnique.mockResolvedValue({ id: "member-1", user_id: "member-user-1" });
    prisma.users.update.mockResolvedValue({ id: "member-user-1" });
    await memberRepository.issueAccountCredentials("member-1", "new-hash");
    expect(prisma.users.update).toHaveBeenCalledWith({ where: { id: "member-user-1" }, data: { password_hash: "new-hash", must_change_password: true } });
    expect(prisma.auth_sessions.updateMany).toHaveBeenCalledWith({ where: { user_id: "member-user-1", revoked_at: null }, data: { revoked_at: expect.any(Date) } });
  });

  it("revokes all existing staff sessions when Admin resets credentials", async () => {
    prisma.users.update.mockResolvedValue({ id: "staff-1" });
    await staffRepository.resetPassword("staff-1", "new-hash");
    expect(prisma.users.update).toHaveBeenCalledWith({ where: { id: "staff-1" }, data: { password_hash: "new-hash", must_change_password: true } });
    expect(prisma.auth_sessions.updateMany).toHaveBeenCalledWith({ where: { user_id: "staff-1", revoked_at: null }, data: { revoked_at: expect.any(Date) } });
  });
});
