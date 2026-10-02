import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createOperationNotificationService } from "../src/modules/notifications/application/operation-notification.service.js";

const actor = { id: "11111111-1111-4111-8111-111111111111", role: "admin", displayName: "Quản trị hệ thống" };
function setup() {
  const repository = { publishForActorAndAdmins: vi.fn().mockResolvedValue(undefined) };
  const siteService = { deletePage: vi.fn().mockResolvedValue({ deleted: true }), listPages: vi.fn().mockResolvedValue([]) };
  const app = createApp({ authService: { getAuthentication: vi.fn().mockResolvedValue({ user: actor, permissions: [] }) }, siteService,
    operationNotificationService: createOperationNotificationService({ repository }) });
  return { app, repository, siteService };
}

describe("admin operation notifications", () => {
  it("uses the bulk submission result to suppress duplicate HTTP notifications", async () => {
    const repository = { publishForActorAndAdmins: vi.fn().mockResolvedValue(undefined) };
    const attendanceService = { submit: vi.fn().mockResolvedValueOnce({ notificationCount: 2 }).mockResolvedValue({ alreadySubmitted: true }) };
    const app = createApp({
      authService: { getAuthentication: vi.fn().mockResolvedValue({ user: actor, permissions: ["attendance.write"] }) },
      attendanceService,
      operationNotificationService: createOperationNotificationService({ repository }),
    });
    const input = { entries: [{ bookingId: "22222222-2222-4222-8222-222222222222", status: "present" }] };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await request(app).post(`/api/v1/classes/${actor.id}/attendance/submit`).set("Authorization", "Bearer token").send(input).expect(200);
    }
    expect(repository.publishForActorAndAdmins).toHaveBeenCalledTimes(1);
  });

  it("announces attendance once after bulk submit, not per member or repeated submit", async () => {
    const repository = { publishForActorAndAdmins: vi.fn().mockResolvedValue(undefined) };
    const service = createOperationNotificationService({ repository });
    for (const path of ["/attendance/check-in", "/attendance/record-1/check-out", "/attendance/record-1/corrections"]) {
      await service.record({ method: "POST", path, actor });
    }
    expect(repository.publishForActorAndAdmins).not.toHaveBeenCalled();
    const submission = { method: "POST", path: "/classes/class-1/attendance/submit", actor };
    await service.record({ ...submission, result: { notificationCount: 20 } });
    await service.record({ ...submission, result: { alreadySubmitted: true } });
    expect(repository.publishForActorAndAdmins).toHaveBeenCalledExactlyOnceWith(actor.id, expect.objectContaining({ title: "Đã chốt điểm danh lớp học" }));
  });

  it("persists the notification before returning the successful mutation", async () => {
    const { app, repository } = setup();
    await request(app).delete("/api/v1/admin/site/pages/about").set("Authorization", "Bearer token").expect(200);
    expect(repository.publishForActorAndAdmins).toHaveBeenCalledExactlyOnceWith(actor.id, expect.objectContaining({ title: "Xóa trang website thành công", body: "Quản trị hệ thống đã thực hiện thao tác này." }));
  });

  it("does not notify for failed or unauthenticated mutations, or reads", async () => {
    const { app, repository, siteService } = setup();
    await request(app).delete("/api/v1/admin/site/pages/about").expect(401);
    siteService.deletePage.mockRejectedValue(new Error("Failed"));
    await request(app).delete("/api/v1/admin/site/pages/about").set("Authorization", "Bearer token").expect(500);
    await request(app).get("/api/v1/admin/site/pages").set("Authorization", "Bearer token").expect(200);
    expect(repository.publishForActorAndAdmins).not.toHaveBeenCalled();
  });

  it("keeps the committed operation successful if notification storage fails", async () => {
    const { app, repository, siteService } = setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    repository.publishForActorAndAdmins.mockRejectedValue({ code: "DATABASE_UNAVAILABLE" });
    try {
      await request(app).delete("/api/v1/admin/site/pages/about").set("Authorization", "Bearer token").expect(200);
      expect(siteService.deletePage).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it.each(["/notifications/123/read", "/admin/site/media/cloudinary/signature", "/auth/logout"])("does not recursively notify for %s", async (path) => {
    const repository = { publishForActorAndAdmins: vi.fn() };
    await createOperationNotificationService({ repository }).record({ method: "POST", path, actor });
    expect(repository.publishForActorAndAdmins).not.toHaveBeenCalled();
  });

  it("records staff submissions for admins without copying request data", async () => {
    const repository = { publishForActorAndAdmins: vi.fn().mockResolvedValue(undefined) };
    await createOperationNotificationService({ repository }).record({ method: "PATCH", path: "/payments/id/confirm", actor: { ...actor, role: "receptionist" } });
    expect(repository.publishForActorAndAdmins).toHaveBeenCalledWith(actor.id, expect.objectContaining({ title: "Cập nhật thanh toán thành công" }));
  });

  it.each(["admin", "manager", "receptionist", "coach", "member"])("publishes a %s actor's successful change to their own bell", async (role) => {
    const repository = { publishForActorAndAdmins: vi.fn().mockResolvedValue(undefined) };
    const currentActor = { ...actor, role };
    await createOperationNotificationService({ repository }).record({ method: "PATCH", path: "/auth/profile", actor: currentActor });
    expect(repository.publishForActorAndAdmins).toHaveBeenCalledExactlyOnceWith(currentActor.id, expect.objectContaining({ title: "Cập nhật tài khoản thành công" }));
  });
});
