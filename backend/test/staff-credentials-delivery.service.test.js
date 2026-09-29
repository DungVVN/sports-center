import { describe, expect, it, vi } from "vitest";
import { createStaffCredentialsDeliveryService } from "../src/modules/staff/index.js";

const config = {
  verificationDeliveryMode: "provider",
  resendApiKey: "re_test",
  resendFromEmail: "no-reply@example.com",
  resendFromName: "Kinetic Sports",
  corsOrigins: ["https://www.kineticsports.io.vn"],
};

describe("staff credential email delivery", () => {
  it("sends the account and one-time password to the staff email", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const service = createStaffCredentialsDeliveryService({ config, fetchImpl });

    await expect(service.deliver({ recipient: "staff@example.com", fullName: "Nguyen Van A", temporaryPassword: "temporary-password" })).resolves.toEqual({ delivered: true, configured: true });

    const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(payload.to).toEqual(["staff@example.com"]);
    expect(payload.subject).toContain("Tài khoản nhân viên");
    expect(payload.text).toContain("temporary-password");
    expect(payload.html).toContain("Đăng nhập lần đầu");
    expect(payload.html).toContain("https://www.kineticsports.io.vn/");
  });

  it("keeps a manual fallback when email is not configured", async () => {
    const service = createStaffCredentialsDeliveryService({ config: { verificationDeliveryMode: "development" }, fetchImpl: vi.fn() });
    await expect(service.deliver({ recipient: "staff@example.com", fullName: "Nguyen Van A", temporaryPassword: "temporary-password" })).resolves.toEqual({ delivered: false, configured: false });
  });

  it("uses the supplied account label for member credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const service = createStaffCredentialsDeliveryService({ config, fetchImpl });

    await service.deliver({ recipient: "member@example.com", fullName: "Nguyen Van B", temporaryPassword: "temporary-password", accountLabel: "hội viên" });

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).subject).toContain("Tài khoản hội viên");
  });
});
