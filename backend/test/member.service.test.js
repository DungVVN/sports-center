import { describe, expect, it, vi } from "vitest";
import { createMemberService } from "../src/modules/members/member.service.js";

describe("Member service contacts", () => {
  it("returns an actionable conflict when an updated phone is already used", async () => {
    const member = { id: "member-1", member_code: "MBR-1", full_name: "An", email: null, phone: "0900000000", date_of_birth: null, gender: null, joined_at: new Date() };
    const repository = {
      findWithContacts: vi.fn().mockResolvedValue({ member, contacts: [] }),
      update: vi.fn().mockRejectedValue({ code: "P2002", meta: { target: ["phone"] } }),
    };

    await expect(createMemberService({ repository, auditService: { record: vi.fn() } }).update("member-1", { phone: "0911111111" }, "receptionist-1"))
      .rejects.toMatchObject({ statusCode: 409, code: "MEMBER_PHONE_EXISTS" });
  });

  it("maps contact fields at the API boundary", async () => {
    const repository = { create: vi.fn().mockResolvedValue({ member: { id: "member-1", member_code: "MBR-1", full_name: "An", email: null, phone: "0900000000", date_of_birth: null, gender: null, joined_at: new Date() }, contacts: [{ id: "contact-1", full_name: "Mai", relationship: "Mẹ", phone: "0911111111", is_primary: true }] }) };
    const auditService = { record: vi.fn().mockResolvedValue(undefined) };
    const result = await createMemberService({ repository, auditService }).create({ fullName: "An", phone: "0900000000", contacts: [{ fullName: "Mai", relationship: "Mẹ", phone: "0911111111", isPrimary: true }] }, "receptionist-1");
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ contacts: [{ full_name: "Mai", relationship: "Mẹ", phone: "0911111111", is_primary: true }] }));
    expect(result.contacts).toEqual([{ id: "contact-1", fullName: "Mai", relationship: "Mẹ", phone: "0911111111", isPrimary: true }]);
  });

  it("creates a member login and sends its one-time password when requested", async () => {
    const member = { id: "member-1", member_code: "MBR-1", full_name: "An", email: "an@example.com", phone: "0900000000", date_of_birth: null, gender: null, joined_at: new Date() };
    const repository = { create: vi.fn().mockResolvedValue({ member, contacts: [] }) };
    const credentialsDelivery = { deliver: vi.fn().mockResolvedValue({ delivered: true }) };
    const auditService = { record: vi.fn().mockResolvedValue(undefined) };

    const result = await createMemberService({ repository, auditService, credentialsDelivery }).create({ fullName: "An", email: "AN@EXAMPLE.COM", phone: "0900000000", contacts: [], createAccount: true }, "receptionist-1");

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      email: "an@example.com",
      account: expect.objectContaining({ email: "an@example.com", fullName: "An", passwordHash: expect.any(String) }),
    }));
    expect(credentialsDelivery.deliver).toHaveBeenCalledWith(expect.objectContaining({ recipient: "an@example.com", accountLabel: "hội viên", temporaryPassword: expect.any(String) }));
    expect(result).toMatchObject({ accountCreated: true, credentialEmailDelivered: true });
    expect(result.temporaryPassword).toBeUndefined();
  });

  it("returns the one-time password only when member credential email delivery fails", async () => {
    const member = { id: "member-1", member_code: "MBR-1", full_name: "An", email: "an@example.com", phone: "0900000000", date_of_birth: null, gender: null, joined_at: new Date() };
    const repository = { create: vi.fn().mockResolvedValue({ member, contacts: [] }) };
    const credentialsDelivery = { deliver: vi.fn().mockResolvedValue({ delivered: false }) };

    const result = await createMemberService({ repository, auditService: { record: vi.fn() }, credentialsDelivery }).create({ fullName: "An", email: "an@example.com", phone: "0900000000", contacts: [], createAccount: true }, "receptionist-1");

    expect(result).toMatchObject({ accountCreated: true, credentialEmailDelivered: false, temporaryPassword: expect.any(String) });
  });

  it("returns the current Coach and membership fields for the management list", async () => {
    const member = { id: "member-1", member_code: "MBR-1", full_name: "An", email: "an@example.test", phone: "0900000000", date_of_birth: null, gender: null, joined_at: new Date() };
    const repository = {
      listWithOverview: vi.fn().mockResolvedValue([{ member, overview: { coachName: "Coach Bình", membership: { package_name_snapshot: "Gói Tiêu chuẩn", status: "active", expires_on: new Date("2026-12-12") } } }]),
      contacts: vi.fn().mockResolvedValue([]),
    };
    const result = await createMemberService({ repository, auditService: { record: vi.fn() } }).list();
    expect(result).toEqual([expect.objectContaining({ coachName: "Coach Bình", registeredPackageName: "Gói Tiêu chuẩn", membershipStatus: "active", membershipExpiresOn: new Date("2026-12-12") })]);
  });
});
