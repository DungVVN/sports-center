import { describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ users: { findMany: vi.fn() }, notifications: { createMany: vi.fn() } }));
vi.mock("../src/database.js", () => ({ prisma }));
vi.doUnmock("../src/modules/notifications/infrastructure/operation-notification.repository.js");
const { operationNotificationRepository } = await import("../src/modules/notifications/infrastructure/operation-notification.repository.js");

describe("operation notification recipients", () => {
  it("targets only the active actor and admins, keeping routine operations out of email", async () => {
    prisma.users.findMany.mockResolvedValue([{ id: "member-1" }, { id: "admin-1" }]);
    prisma.notifications.createMany.mockResolvedValue({ count: 2 });
    await operationNotificationRepository.publishForActorAndAdmins("member-1", { title: "Cập nhật tài khoản thành công", body: "Đã cập nhật", link_path: null });
    expect(prisma.users.findMany).toHaveBeenCalledWith({ where: { status: "active", OR: [{ id: "member-1" }, { role: "admin" }] }, select: { id: true } });
    expect(prisma.notifications.createMany).toHaveBeenCalledWith({ data: [
      expect.objectContaining({ recipient_user_id: "member-1", category: "system", email_skipped_at: expect.any(Date) }),
      expect.objectContaining({ recipient_user_id: "admin-1", category: "system", email_skipped_at: expect.any(Date) }),
    ] });
  });

  it("creates a single notification when the actor is already an admin", async () => {
    prisma.users.findMany.mockResolvedValue([{ id: "admin-1" }]);
    await operationNotificationRepository.publishForActorAndAdmins("admin-1", { title: "Đã cập nhật", body: "Đã cập nhật" });
    expect(prisma.notifications.createMany.mock.lastCall[0].data).toHaveLength(1);
  });
});
