import { describe, expect, it, vi } from "vitest";
import { createVerificationDeliveryService } from "../src/modules/auth/verification-delivery.service.js";

describe("Resend verification delivery", () => {
  it("sends an email verification code through Resend", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const service = createVerificationDeliveryService({
      config: {
        verificationDeliveryMode: "provider",
        resendApiKey: "re_test_key",
        resendFromEmail: "no-reply@example.com",
        resendFromName: "Kinetic Sports",
        verificationCodeTtlMinutes: 10,
      },
      fetchImpl,
    });

    await expect(service.deliver({ channel: "email", code: "123456", recipient: "member@example.com" })).resolves.toEqual({ delivered: true });
    expect(fetchImpl).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer re_test_key" }),
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      from: "Kinetic Sports <no-reply@example.com>",
      to: ["member@example.com"],
      subject: "Mã xác thực tài khoản Kinetic Sports",
    });
  });

  it("does not send when the Resend provider is incomplete", async () => {
    const service = createVerificationDeliveryService({ config: { verificationDeliveryMode: "provider" }, fetchImpl: vi.fn() });
    await expect(service.deliver({ channel: "email", code: "123456", recipient: "member@example.com" }))
      .rejects.toMatchObject({ code: "VERIFICATION_DELIVERY_NOT_CONFIGURED", statusCode: 503 });
  });
});
