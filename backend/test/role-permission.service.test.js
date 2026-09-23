import request from "supertest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createRolePermissionService } from "../src/modules/role-permissions/role-permission.service.js";
import { assignablePermissionCodes } from "../src/modules/role-permissions/permission-catalog.js";

const matrix = {
  permissions: [{ code: "class.read", description: "Xem lớp học" }, { code: "payment.read", description: "Xem thanh toán" }],
  roles: [{ code: "manager", label: "Quản lý", permission_version: 2 }],
  grants: [{ role_code: "manager", permission_code: "class.read" }],
};

function setup() {
  const repository = { matrix: vi.fn().mockResolvedValue(matrix), replace: vi.fn().mockResolvedValue({ kind: "updated", role: "manager", version: 3, permissionCodes: [] }) };
  return { repository, service: createRolePermissionService({ repository }) };
}

describe("role permission configuration", () => {
  it("lists exactly the permission codes enforced by mounted routes", () => {
    const modules = fileURLToPath(new URL("../src/modules/", import.meta.url));
    const enforced = new Set();
    for (const name of readdirSync(modules)) {
      for (const file of readdirSync(join(modules, name)).filter((item) => item.endsWith(".routes.js"))) {
        const source = readFileSync(join(modules, name, file), "utf8");
        for (const match of source.matchAll(/requirePermission\("([^"]+)"\)/g)) enforced.add(match[1]);
      }
    }
    expect([...assignablePermissionCodes].sort()).toEqual([...enforced].sort());
  });
  it("shows all four fixed roles and accepts a role with zero permissions", async () => {
    const { service, repository } = setup();
    const result = await service.matrix();
    expect(result.roles).toHaveLength(4);
    expect(result.roles.find((role) => role.code === "manager")).toMatchObject({ version: 2, permissionCodes: ["class.read"] });
    expect(result.roles.find((role) => role.code === "coach").permissionCodes).toEqual([]);
    await expect(service.replace({ role: "manager", version: 2, permissionCodes: [], actorUserId: "admin-1" })).resolves.toMatchObject({ version: 3 });
    expect(repository.replace).toHaveBeenCalledWith({ role: "manager", version: 2, permissionCodes: [], actorUserId: "admin-1" });
  });

  it("lets Admin assign facility functions by permission rather than a fixed role", async () => {
    const { service, repository } = setup();
    await service.replace({ role: "receptionist", version: 0, permissionCodes: ["facility.manage", "facility.day.manage"], actorUserId: "admin-1" });
    expect(repository.replace).toHaveBeenCalledWith({ role: "receptionist", version: 0, permissionCodes: ["facility.day.manage", "facility.manage"], actorUserId: "admin-1" });
    await service.replace({ role: "coach", version: 0, permissionCodes: ["facility.booking.self.read", "facility.booking.request"], actorUserId: "admin-1" });
    expect(repository.replace).toHaveBeenCalledWith({ role: "coach", version: 0, permissionCodes: ["facility.booking.request", "facility.booking.self.read"], actorUserId: "admin-1" });
  });

  it("rejects Admin modification, duplicate codes and stale edits", async () => {
    const { service, repository } = setup();
    await expect(service.replace({ role: "admin", version: 0, permissionCodes: [], actorUserId: "admin-1" })).rejects.toMatchObject({ code: "ROLE_NOT_CONFIGURABLE" });
    await expect(service.replace({ role: "coach", version: 0, permissionCodes: ["class.read", "class.read"], actorUserId: "admin-1" })).rejects.toMatchObject({ code: "DUPLICATE_PERMISSION" });
    await expect(service.replace({ role: "coach", version: 0, permissionCodes: ["attendance.write"], actorUserId: "admin-1" })).rejects.toMatchObject({ code: "PERMISSION_DEPENDENCY_MISSING" });
    await expect(service.replace({ role: "coach", version: 0, permissionCodes: ["training.self.read"], actorUserId: "admin-1" })).rejects.toMatchObject({ code: "PERMISSION_ROLE_SCOPE_INVALID" });
    await expect(service.replace({ role: "manager", version: 0, permissionCodes: ["class.read", "booking.read", "booking.write"], actorUserId: "admin-1" })).rejects.toMatchObject({ code: "PERMISSION_DEPENDENCY_MISSING" });
    repository.replace.mockResolvedValueOnce({ kind: "stale" });
    await expect(service.replace({ role: "manager", version: 1, permissionCodes: [], actorUserId: "admin-1" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("protects both endpoints and validates the update payload", async () => {
    const { service } = setup();
    const authService = { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "staff-1", role: "manager" }, permissions: [] }) };
    const app = createApp({ authService, rolePermissionService: service });
    await request(app).get("/api/v1/admin/permissions/matrix").expect(401);
    await request(app).get("/api/v1/admin/permissions/matrix").set("Authorization", "Bearer token").expect(403);
    authService.getAuthentication.mockResolvedValue({ user: { id: "admin-1", role: "admin" }, permissions: [] });
    await request(app).get("/api/v1/admin/permissions/matrix").set("Authorization", "Bearer token").expect(200);
    await request(app).put("/api/v1/admin/roles/manager/permissions").set("Authorization", "Bearer token").send({ version: 2, permissionCodes: [] }).expect(200);
    await request(app).put("/api/v1/admin/roles/manager/permissions").set("Authorization", "Bearer token").send({ version: -1, permissionCodes: [] }).expect(422);
  });

  it("enforces a revoked permission on the next request", async () => {
    const authService = { getAuthentication: vi.fn().mockResolvedValue({ user: { id: "manager-1", role: "manager" }, permissions: ["payment.read"] }) };
    const paymentService = { list: vi.fn().mockResolvedValue([]) };
    const app = createApp({ authService, paymentService });
    await request(app).get("/api/v1/payments").set("Authorization", "Bearer token").expect(200);
    authService.getAuthentication.mockResolvedValue({ user: { id: "manager-1", role: "manager" }, permissions: [] });
    await request(app).get("/api/v1/payments").set("Authorization", "Bearer token").expect(403);
    expect(paymentService.list).toHaveBeenCalledTimes(1);
  });
});
