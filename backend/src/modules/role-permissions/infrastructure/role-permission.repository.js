import { prisma } from "../../../database.js";
import { assignablePermissionCodes } from "../domain/permission-catalog.js";

export const rolePermissionRepository = {
  async matrix() {
    const [permissions, roles, grants] = await Promise.all([
      prisma.permissions.findMany({ where: { code: { in: assignablePermissionCodes } }, orderBy: { code: "asc" } }),
      prisma.roles.findMany({ where: { code: { in: ["manager", "receptionist", "coach", "member"] } }, orderBy: { code: "asc" } }),
      prisma.role_permissions.findMany({ where: { role_code: { in: ["manager", "receptionist", "coach", "member"] } } }),
    ]);
    return { permissions, roles, grants };
  },

  async replace({ role, version, permissionCodes, actorUserId }) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.roles.findUnique({ where: { code: role } });
      if (!current) return { kind: "missing" };
      if (current.permission_version !== version) return { kind: "stale" };
      if (permissionCodes.some((code) => !assignablePermissionCodes.includes(code))) return { kind: "unknown" };
      const existing = await tx.permissions.findMany({ where: { code: { in: permissionCodes } }, select: { code: true } });
      if (existing.length !== permissionCodes.length) return { kind: "unknown" };
      const updated = await tx.roles.updateMany({ where: { code: role, permission_version: version }, data: { permission_version: { increment: 1 } } });
      if (updated.count !== 1) return { kind: "stale" };
      const before = await tx.role_permissions.findMany({ where: { role_code: role }, select: { permission_code: true } });
      await tx.role_permissions.deleteMany({ where: { role_code: role } });
      if (permissionCodes.length) {
        await tx.role_permissions.createMany({ data: permissionCodes.map((permissionCode) => ({ role_code: role, permission_code: permissionCode })) });
      }
      await tx.audit_logs.create({ data: {
        actor_user_id: actorUserId,
        action: "role.permissions.updated",
        entity_type: "role",
        summary: `Đã cập nhật quyền của vai trò ${role}.`,
        previous_value: { role, version, permissionCodes: before.map((item) => item.permission_code).sort() },
        new_value: { role, version: version + 1, permissionCodes },
      } });
      return { kind: "updated", role, version: version + 1, permissionCodes };
    });
  },
};
