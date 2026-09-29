import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const staffId = "11111111-1111-4111-8111-111111111111";
const staffService = () => ({ resetPassword: vi.fn().mockResolvedValue({ credentialEmailDelivered: false, temporaryPassword: "temporary" }) });
const authService = (role) => ({ getAuthentication: vi.fn().mockResolvedValue({ user: { id: `${role}-1`, role }, permissions: ["staff.manage"] }) });

describe("staff credential reset route", () => {
  it("allows Admin to reset a staff password", async () => {
    const service = staffService();
    await request(createApp({ authService: authService("admin"), staffService: service }))
      .post(`/api/v1/staff/${staffId}/account-credentials`).set("Authorization", "Bearer token").expect(200);
    expect(service.resetPassword).toHaveBeenCalledWith(staffId, "admin-1");
  });

  it("denies a Manager even if staff.manage has been granted", async () => {
    const service = staffService();
    await request(createApp({ authService: authService("manager"), staffService: service }))
      .post(`/api/v1/staff/${staffId}/account-credentials`).set("Authorization", "Bearer token").expect(403);
    expect(service.resetPassword).not.toHaveBeenCalled();
  });
});
