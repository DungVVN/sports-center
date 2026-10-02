import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditEntityQuery } from "../src/modules/audit/presentation/audit-query.js";
import { auditRepository } from "../src/modules/audit/infrastructure/audit.repository.js";
import { prisma } from "../src/database.js";

vi.mock("../src/database.js", () => ({ prisma: {
  audit_logs: { count: vi.fn(), findMany: vi.fn() },
  users: { findMany: vi.fn() }, class_sessions: { findMany: vi.fn() },
  bookings: { findMany: vi.fn() }, members: { findMany: vi.fn() },
  member_memberships: { findMany: vi.fn() }, payments: { findMany: vi.fn() },
  training_plans: { findMany: vi.fn() }, training_plan_templates: { findMany: vi.fn() },
} }));
const id = "11111111-1111-4111-8111-111111111111";

describe("record audit filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const model of Object.values(prisma)) model.findMany.mockResolvedValue([]);
    prisma.audit_logs.count.mockResolvedValue(0);
  });
  it("requires a complete, valid pair of entity filters", () => {
    expect(auditEntityQuery.safeParse({}).success).toBe(true);
    expect(auditEntityQuery.safeParse({ entityType: "booking", entityId: id }).success).toBe(true);
    for (const query of [{ entityType: "booking" }, { entityId: id }, { entityType: "booking", entityId: "invalid" }, { entityType: ["booking"], entityId: id }]) {
      expect(auditEntityQuery.safeParse(query).success).toBe(false);
    }
  });
  it("applies the same record scope to the count and paginated rows", async () => {
    prisma.audit_logs.count.mockResolvedValue(25);
    const result = await auditRepository.list({ page: 2, pageSize: 20, entityType: "booking", entityId: id });
    const where = { entity_type: "booking", entity_id: id };
    expect(prisma.audit_logs.count).toHaveBeenCalledWith({ where });
    expect(prisma.audit_logs.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 20, take: 20 }));
    expect(result.pagination).toEqual({ page: 2, pageSize: 20, total: 25, totalPages: 2 });
  });
  it("preserves the complete audit list without record filters", async () => {
    await auditRepository.list({ page: 1, pageSize: 20 });
    expect(prisma.audit_logs.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
  it("resolves security, profile and role events without technical display values", async () => {
    prisma.audit_logs.findMany.mockResolvedValue([
      { entity_type: "auth_mfa_enrollment", entity_id: id, actor_user_id: "actor" },
      { entity_type: "auth_session", entity_id: id, actor_user_id: "actor" },
      { entity_type: "staff_profile", entity_id: id },
      { entity_type: "role", new_value: { role: "coach" } },
      { entity_type: "role", previous_value: { role: "member" } },
      { entity_type: "unknown_internal_type", entity_id: id },
    ]);
    prisma.users.findMany.mockResolvedValueOnce([{ id: "actor", display_name: "Quản trị hệ thống" }]).mockResolvedValueOnce([{ id, display_name: "Nguyễn An" }]);
    const { items } = await auditRepository.list({ page: 1, pageSize: 20 });
    expect(items.map((item) => item.entity)).toEqual([
      { label: "Đăng ký Authenticator", value: "Quản trị hệ thống" },
      { label: "Phiên đăng nhập", value: "Quản trị hệ thống" },
      { label: "Hồ sơ nhân sự", value: "Nguyễn An" },
      { label: "Vai trò", value: "Huấn luyện viên" },
      { label: "Vai trò", value: "Hội viên" },
      { label: "Đối tượng hệ thống", value: null },
    ]);
    expect(items[0].entity_id).toBe(id);
    expect(prisma.users.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: { in: [id] } } }));
  });
  it("keeps labels and original IDs when the target record is no longer available", async () => {
    prisma.audit_logs.findMany.mockResolvedValue([{ entity_type: "staff_profile", entity_id: id }, { entity_type: "auth_mfa_login_challenge", entity_id: id }]);
    const { items } = await auditRepository.list({ page: 1, pageSize: 20 });
    expect(items[0]).toMatchObject({ entity_id: id, entity: { label: "Hồ sơ nhân sự", value: null } });
    expect(items[1].entity).toEqual({ label: "Xác minh Authenticator", value: null });
  });
});
