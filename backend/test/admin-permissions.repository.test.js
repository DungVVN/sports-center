import { describe, expect, it, vi } from "vitest";
import { prisma } from "../src/database.js";
import { authRepository } from "../src/modules/auth/index.js";

vi.mock("../src/database.js", () => ({ prisma: {
  permissions: { findMany: vi.fn() },
  role_permissions: { findMany: vi.fn() },
} }));

describe("Admin permission resolution", () => {
  it("returns every current permission for Admin, including permissions added after the Admin migration", async () => {
    prisma.permissions.findMany.mockResolvedValue([{ code: "audit.read" }, { code: "attendance.write" }, { code: "future.permission" }]);
    await expect(authRepository.getPermissions("admin")).resolves.toEqual([
      { permission_code: "audit.read" },
      { permission_code: "attendance.write" },
      { permission_code: "future.permission" },
    ]);
    expect(prisma.role_permissions.findMany).not.toHaveBeenCalled();
  });

  it("still resolves other roles only through their assigned permissions", async () => {
    prisma.role_permissions.findMany.mockResolvedValue([{ permission_code: "booking.read" }]);
    await expect(authRepository.getPermissions("manager")).resolves.toEqual([{ permission_code: "booking.read" }]);
    expect(prisma.role_permissions.findMany).toHaveBeenCalledWith({ where: { role_code: "manager" }, select: { permission_code: true } });
  });
});
