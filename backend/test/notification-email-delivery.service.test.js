import { describe, expect, it, vi } from "vitest";
import { createNotificationEmailDeliveryService } from "../src/modules/notifications/index.js";

const config = { verificationDeliveryMode: "provider", resendApiKey: "re_test", resendFromEmail: "no-reply@example.com", resendFromName: "Kinetic Sports", publicWebOrigin: "https://www.example.com", corsOrigins: ["http://localhost:5173"] };
const notification = { id: "notification-1", title: "Đã có chỗ trong lớp", body: "Bạn đã được xác nhận.", link_path: "/bookings/booking-1", recipient: { email: "member@example.com" }, emailEnabled: true };

describe("notification email delivery service", () => {
  it("keeps both HTML and text links public when legacy configuration only allows localhost", async () => {
    const repository = { pending: vi.fn().mockResolvedValue([notification]), claim: vi.fn().mockResolvedValue({ count: 1 }), delivered: vi.fn(), skipped: vi.fn(), failed: vi.fn() };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const legacyConfig = { ...config };
    delete legacyConfig.publicWebOrigin;
    await createNotificationEmailDeliveryService({ repository, config: legacyConfig, fetchImpl }).deliverPending();
    const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(payload.text).toContain("https://kineticsports.io.vn/bookings/booking-1");
    expect(payload.html).toContain('href="https://kineticsports.io.vn/bookings/booking-1"');
    expect(payload.html).not.toContain("localhost");
  });
  it("claims, sends and records an email exactly once", async () => {
    const repository = { pending: vi.fn().mockResolvedValue([notification]), claim: vi.fn().mockResolvedValue({ count: 1 }), delivered: vi.fn(), skipped: vi.fn(), failed: vi.fn() };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const result = await createNotificationEmailDeliveryService({ repository, config, fetchImpl, now: () => new Date("2026-09-22T00:00:00Z") }).deliverPending();
    expect(result).toMatchObject({ configured: true, delivered: 1, skipped: 0, failed: 0 });
    expect(repository.delivered).toHaveBeenCalledWith("notification-1", expect.any(Date));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({ to: ["member@example.com"], subject: "[Kinetic Sports] Đã có chỗ trong lớp", text: expect.stringContaining("https://www.example.com/bookings/booking-1") });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).html).toContain('href="https://www.example.com/bookings/booking-1"');
  });
  it("records a skip without calling Resend when email is disabled", async () => {
    const repository = { pending: vi.fn().mockResolvedValue([{ ...notification, emailEnabled: false }]), claim: vi.fn().mockResolvedValue({ count: 1 }), delivered: vi.fn(), skipped: vi.fn(), failed: vi.fn() };
    const fetchImpl = vi.fn();
    const result = await createNotificationEmailDeliveryService({ repository, config, fetchImpl }).deliverPending();
    expect(result).toMatchObject({ skipped: 1 });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(repository.skipped).toHaveBeenCalled();
  });
  it("records a retryable failure without leaking provider details", async () => {
    const repository = { pending: vi.fn().mockResolvedValue([notification]), claim: vi.fn().mockResolvedValue({ count: 1 }), delivered: vi.fn(), skipped: vi.fn(), failed: vi.fn() };
    const result = await createNotificationEmailDeliveryService({ repository, config, fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 503 }), logger: { error: vi.fn() } }).deliverPending();
    expect(result).toMatchObject({ failed: 1 });
    expect(repository.failed).toHaveBeenCalledWith("notification-1", "Resend returned HTTP 503");
  });
});
