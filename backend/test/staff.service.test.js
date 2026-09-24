import { describe, expect, it, vi } from "vitest";
import { createStaffService } from "../src/modules/staff/staff.service.js";

const input = { fullName: "Nguyen Van A", email: "STAFF@example.com", phone: "0900000000", role: "receptionist" };
const createdStaff = { id: "staff-1", email: "staff@example.com", display_name: "Nguyen Van A", role: "receptionist", status: "active", staff_profiles: { employee_code: "STF-1234", phone: "0900000000" } };

function serviceWith(delivery) {
  return createStaffService({ repository: { findByEmail: vi.fn().mockResolvedValue(null), findByPhone: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(createdStaff) }, auditService: { record: vi.fn().mockResolvedValue({}) }, credentialsDelivery: delivery });
}

describe("staff creation credentials", () => {
  it("sends credentials and does not return a plaintext password after delivery", async () => {
    const delivery = { deliver: vi.fn().mockResolvedValue({ delivered: true }) };
    const result = await serviceWith(delivery).create(input, "manager-1");

    expect(delivery.deliver).toHaveBeenCalledWith(expect.objectContaining({ recipient: "staff@example.com", fullName: "Nguyen Van A" }));
    expect(result).toMatchObject({ credentialEmailDelivered: true, staff: { email: "staff@example.com" } });
    expect(result.temporaryPassword).toBeUndefined();
  });

  it("returns the one-time password only when delivery is unavailable", async () => {
    const result = await serviceWith({ deliver: vi.fn().mockResolvedValue({ delivered: false }) }).create(input, "manager-1");
    expect(result.credentialEmailDelivered).toBe(false);
    expect(result.temporaryPassword).toEqual(expect.any(String));
  });

  it("rejects an existing staff phone as a conflict before creating an account", async () => {
    const repository = { findByEmail: vi.fn().mockResolvedValue(null), findByPhone: vi.fn().mockResolvedValue({ user_id: "staff-1" }), create: vi.fn() };
    const service = createStaffService({ repository, auditService: { record: vi.fn() }, credentialsDelivery: { deliver: vi.fn() } });

    await expect(service.create(input, "manager-1")).rejects.toMatchObject({
      statusCode: 409,
      code: "STAFF_PHONE_EXISTS",
      message: "Số điện thoại này đã được sử dụng.",
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("maps a concurrent phone collision to a conflict", async () => {
    const repository = { findByEmail: vi.fn().mockResolvedValue(null), findByPhone: vi.fn().mockResolvedValue(null), create: vi.fn().mockRejectedValue({ code: "P2002", meta: { target: ["phone"] } }) };
    const service = createStaffService({ repository, auditService: { record: vi.fn() }, credentialsDelivery: { deliver: vi.fn() } });

    await expect(service.create(input, "manager-1")).rejects.toMatchObject({
      statusCode: 409,
      code: "STAFF_PHONE_EXISTS",
      message: "Số điện thoại này đã được sử dụng.",
    });
  });
});
