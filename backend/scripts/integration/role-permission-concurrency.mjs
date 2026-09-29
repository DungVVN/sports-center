import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is required for isolated permission concurrency checks.");
const parsed = new URL(testUrl);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !parsed.pathname.startsWith("/sports_center_arch_qa")) {
  throw new Error("Refusing to write outside a localhost sports_center_arch_qa database.");
}
process.env.DATABASE_URL = testUrl;

const { prisma } = await import("../../src/database.js");
const { rolePermissionRepository } = await import("../../src/modules/role-permissions/index.js");
const actorUserId = randomUUID();
const role = "manager";
let initial;
let originalGrants;
let actorCreated = false;

try {
  initial = await prisma.roles.findUnique({ where: { code: role } });
  assert.ok(initial, "Expected the manager role from migrations");
  await prisma.users.create({ data: { id: actorUserId, email: `qa-role-race-${actorUserId}@architecture.test`, password_hash: "isolated-test-only", display_name: "Role race QA", role: "admin" } });
  actorCreated = true;
  originalGrants = await prisma.role_permissions.findMany({ where: { role_code: role }, select: { permission_code: true } });
  // A repository-level concurrency check uses an empty valid selection; initial
  // migration grants can include non-configurable permissions.
  const permissionCodes = [];
  const results = await Promise.all([
    rolePermissionRepository.replace({ role, version: initial.permission_version, permissionCodes, actorUserId }),
    rolePermissionRepository.replace({ role, version: initial.permission_version, permissionCodes, actorUserId }),
  ]);
  assert.deepEqual(results.map((item) => item.kind).sort(), ["stale", "updated"]);
  assert.equal((await prisma.roles.findUnique({ where: { code: role } })).permission_version, initial.permission_version + 1);
  assert.deepEqual((await prisma.role_permissions.findMany({ where: { role_code: role }, select: { permission_code: true } })).map((item) => item.permission_code).sort(), permissionCodes);
  console.log("Isolated PostgreSQL role-permission optimistic concurrency passed: one update, one stale, grants unchanged.");
} finally {
  if (initial && originalGrants) await prisma.$transaction(async (tx) => {
    await tx.role_permissions.deleteMany({ where: { role_code: role } });
    if (originalGrants.length) await tx.role_permissions.createMany({ data: originalGrants.map((item) => ({ role_code: role, permission_code: item.permission_code })) });
    await tx.roles.update({ where: { code: role }, data: { permission_version: initial.permission_version } });
  });
  await prisma.audit_logs.deleteMany({ where: { actor_user_id: actorUserId } });
  if (actorCreated) await prisma.users.delete({ where: { id: actorUserId } });
  await prisma.$disconnect();
}
