import { describe, expect, it, vi } from "vitest";
import { createSupportService } from "../src/modules/support/support.service.js";
const member = { id: "user-1", role: "member" };
describe("support service", () => {
  it("scopes a member ticket list to that member", async () => { const repository = { memberByUser: vi.fn().mockResolvedValue({ id: "member-1" }), tickets: vi.fn().mockResolvedValue([]) }; await createSupportService({ repository, auditService: { record: vi.fn() } }).list(member); expect(repository.tickets).toHaveBeenCalledWith({ member_id: "member-1" }); });
  it("does not let a member respond as staff", async () => { const repository = { memberByUser: vi.fn().mockResolvedValue({ id: "member-1" }), ticket: vi.fn().mockResolvedValue({ id: "ticket-1", member_id: "member-1" }) }; await expect(createSupportService({ repository, auditService: { record: vi.fn() } }).respond("ticket-1", { body: "Xin hỗ trợ" }, member)).rejects.toMatchObject({ code: "SUPPORT_RESPONSE_FORBIDDEN" }); });
});
