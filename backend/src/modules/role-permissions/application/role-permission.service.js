import { AppError } from "../../../shared/errors/app-error.js";
import { permissionDependencies, permissionRoleDependencies, permissionRoleScopes } from "../domain/permission-catalog.js";

export const configurableRoles = ["manager", "receptionist", "coach", "member"];
const descriptions = {
  "facility.booking.read": "Xem danh sách và chi tiết mọi đơn đặt sân (nhân viên)",
  "facility.booking.self.read": "Xem danh sách và chi tiết đơn đặt sân của bản thân",
  "facility.booking.cancel": "Hủy đơn đặt sân có lý do (Hội viên: chỉ đơn của mình)",
};

export function createRolePermissionService({ repository }) {
  return {
    async matrix() {
      const { permissions, roles, grants } = await repository.matrix();
      const visibleCodes = new Set(permissions.map((item) => item.code));
      return {
        permissions: permissions.map(({ code, description }) => ({ code, description: descriptions[code] ?? description, group: code.split(".")[0], requires: permissionDependencies[code] ?? [], requiresByRole: permissionRoleDependencies[code] ?? {}, availableRoles: permissionRoleScopes[code] ?? configurableRoles })),
        roles: configurableRoles.map((code) => {
          const role = roles.find((item) => item.code === code);
          return { code, label: role?.label ?? code, version: role?.permission_version ?? 0, permissionCodes: grants.filter((item) => item.role_code === code && visibleCodes.has(item.permission_code) && (!permissionRoleScopes[item.permission_code] || permissionRoleScopes[item.permission_code].includes(code))).map((item) => item.permission_code).sort() };
        }),
      };
    },
    async replace({ role, version, permissionCodes, actorUserId }) {
      if (!configurableRoles.includes(role)) throw new AppError({ statusCode: 422, code: "ROLE_NOT_CONFIGURABLE", message: "Chỉ có thể cấu hình bốn vai trò nghiệp vụ." });
      if (new Set(permissionCodes).size !== permissionCodes.length) throw new AppError({ statusCode: 422, code: "DUPLICATE_PERMISSION", message: "Danh sách quyền bị trùng." });
      const selected = new Set(permissionCodes);
      for (const code of selected) {
        if (permissionRoleScopes[code] && !permissionRoleScopes[code].includes(role)) throw new AppError({ statusCode: 422, code: "PERMISSION_ROLE_SCOPE_INVALID", message: `Quyền ${code} không áp dụng cho vai trò ${role}.` });
        const missing = [...(permissionDependencies[code] ?? []), ...(permissionRoleDependencies[code]?.[role] ?? [])].filter((required) => !selected.has(required));
        if (missing.length) throw new AppError({ statusCode: 422, code: "PERMISSION_DEPENDENCY_MISSING", message: `Quyền ${code} cần thêm: ${missing.join(", ")}.` });
      }
      const result = await repository.replace({ role, version, permissionCodes: [...permissionCodes].sort(), actorUserId });
      if (result.kind === "missing") throw new AppError({ statusCode: 404, code: "ROLE_NOT_FOUND", message: "Vai trò không tồn tại." });
      if (result.kind === "stale") throw new AppError({ statusCode: 409, code: "ROLE_PERMISSIONS_CHANGED", message: "Quyền đã được người khác cập nhật. Vui lòng tải lại bảng." });
      if (result.kind === "unknown") throw new AppError({ statusCode: 422, code: "UNKNOWN_PERMISSION", message: "Danh sách có quyền không tồn tại." });
      return result;
    },
  };
}
