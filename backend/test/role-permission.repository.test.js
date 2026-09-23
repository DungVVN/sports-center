import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/database.js";
import { rolePermissionRepository } from "../src/modules/role-permissions/role-permission.repository.js";

vi.mock("../src/database.js", () => ({ prisma: { $transaction: vi.fn() } }));

function transactionClient() {
  return {
    roles: { findUnique: vi.fn().mockResolvedValue({ code: "manager", permission_version: 2 }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    permissions: { findMany: vi.fn().mockResolvedValue([{ code: "payment.read" }]) },
    role_permissions: { findMany: vi.fn().mockResolvedValue([{ permission_code: "class.read" }]), deleteMany: vi.fn(), createMany: vi.fn() },
    audit_logs: { create: vi.fn() },
  };
}

describe("role permission transaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("replaces grants and records before/after audit under the versioned transaction", async () => {
    const tx = transactionClient();
    prisma.$transaction.mockImplementation((work) => work(tx));
    await expect(rolePermissionRepository.replace({ role: "manager", version: 2, permissionCodes: ["payment.read"], actorUserId: "admin-1" })).resolves.toMatchObject({ kind: "updated", version: 3 });
    expect(tx.roles.updateMany).toHaveBeenCalledWith({ where: { code: "manager", permission_version: 2 }, data: { permission_version: { increment: 1 } } });
    expect(tx.role_permissions.deleteMany).toHaveBeenCalledWith({ where: { role_code: "manager" } });
    expect(tx.role_permissions.createMany).toHaveBeenCalledWith({ data: [{ role_code: "manager", permission_code: "payment.read" }] });
    expect(tx.audit_logs.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "role.permissions.updated", actor_user_id: "admin-1", previous_value: { role: "manager", version: 2, permissionCodes: ["class.read"] }, new_value: { role: "manager", version: 3, permissionCodes: ["payment.read"] } }) });
  });

  it("does not write on a stale version or unknown permission", async () => {
    const tx = transactionClient();
    prisma.$transaction.mockImplementation((work) => work(tx));
    await expect(rolePermissionRepository.replace({ role: "manager", version: 1, permissionCodes: [], actorUserId: "admin-1" })).resolves.toMatchObject({ kind: "stale" });
    await expect(rolePermissionRepository.replace({ role: "manager", version: 2, permissionCodes: ["unused.permission"], actorUserId: "admin-1" })).resolves.toMatchObject({ kind: "unknown" });
    expect(tx.roles.updateMany).not.toHaveBeenCalled();
    expect(tx.role_permissions.deleteMany).not.toHaveBeenCalled();
    expect(tx.audit_logs.create).not.toHaveBeenCalled();
  });
});
