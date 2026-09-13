import { describe, expect, it, vi } from "vitest";
import { createMemberService } from "../src/modules/members/member.service.js";

describe("Member service contacts", () => {
  it("maps contact fields at the API boundary", async () => {
    const repository = { create: vi.fn().mockResolvedValue({ member: { id: "member-1", member_code: "MBR-1", full_name: "An", email: null, phone: "0900000000", date_of_birth: null, gender: null, joined_at: new Date() }, contacts: [{ id: "contact-1", full_name: "Mai", relationship: "Mẹ", phone: "0911111111", is_primary: true }] }) };
    const auditService = { record: vi.fn().mockResolvedValue(undefined) };
    const result = await createMemberService({ repository, auditService }).create({ fullName: "An", phone: "0900000000", contacts: [{ fullName: "Mai", relationship: "Mẹ", phone: "0911111111", isPrimary: true }] }, "receptionist-1");
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ contacts: [{ full_name: "Mai", relationship: "Mẹ", phone: "0911111111", is_primary: true }] }));
    expect(result.contacts).toEqual([{ id: "contact-1", fullName: "Mai", relationship: "Mẹ", phone: "0911111111", isPrimary: true }]);
  });
});
