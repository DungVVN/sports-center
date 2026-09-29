import { describe, expect, it, vi } from "vitest";
import { createSupportService } from "../src/modules/support/application/support.service.js";
const member = { id: "user-1", role: "member" };
function createTestSupportService({ repository, auditService }) {
  return createSupportService({
    repository,
    auditService,
    memberDirectory: {
      findByUserId: repository.memberByUser ?? vi.fn().mockResolvedValue({ id: "member-1" }),
      find: async (id) => ({ user_id: await repository.memberUserId?.(id) }),
    },
    notificationPublisher: { notifyMember: repository.notifyUser ?? vi.fn() },
  });
}
describe("support service", () => {
  it("scopes a member ticket list to that member", async () => { const repository = { memberByUser: vi.fn().mockResolvedValue({ id: "member-1" }), tickets: vi.fn().mockResolvedValue([]) }; await createTestSupportService({ repository, auditService: { record: vi.fn() } }).list(member); expect(repository.tickets).toHaveBeenCalledWith({ member_id: "member-1" }); });
  it("keeps a member within their own ticket when a response permission is granted", async () => { const repository = { memberByUser: vi.fn().mockResolvedValue({ id: "member-1" }), ticket: vi.fn().mockResolvedValue({ id: "ticket-1", member_id: "another-member" }) }; await expect(createTestSupportService({ repository, auditService: { record: vi.fn() } }).respond("ticket-1", { body: "Xin hỗ trợ" }, member)).rejects.toMatchObject({ code: "SUPPORT_TICKET_ACCESS_DENIED" }); });
  it("persists the normal priority accepted by the member form", async () => { const repository = { memberByUser: vi.fn().mockResolvedValue({ id: "member-1" }), create: vi.fn().mockResolvedValue({ id: "ticket-1" }) }; const auditService = { record: vi.fn() }; await createTestSupportService({ repository, auditService }).create({ subject: "Cần hỗ trợ", body: "Nội dung kiểm thử", priority: "normal" }, member); expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ member_id: "member-1", priority: "normal" })); });
  it("assigns a ticket owner and moves an open ticket to in progress", async () => { const repository = { ticket: vi.fn().mockResolvedValue({ id: "ticket-1", status: "open" }), update: vi.fn().mockResolvedValue({ id: "ticket-1", assigned_to: "staff-1", status: "in_progress" }) }; const auditService = { record: vi.fn() }; await expect(createTestSupportService({ repository, auditService }).assignSelf("ticket-1", { id: "staff-1", role: "receptionist" })).resolves.toMatchObject({ assigned_to: "staff-1", status: "in_progress" }); expect(repository.update).toHaveBeenCalledWith("ticket-1", { assigned_to: "staff-1", status: "in_progress" }); });
  it("lets any operator with route permission read the queue while preserving member ownership", async () => { const repository = { tickets: vi.fn().mockResolvedValue([]) }; const service = createTestSupportService({ repository, auditService: { record: vi.fn() } }); await expect(service.list({ id: "admin-1", role: "admin" })).resolves.toEqual([]); await expect(service.list({ id: "coach-1", role: "coach" })).resolves.toEqual([]); expect(repository.tickets).toHaveBeenCalledWith({}); });
  it("publishes a member notification through the Notifications capability", async () => {
    const repository = {
      ticket: vi.fn().mockResolvedValue({ id: "ticket-1", ticket_code: "SUP-01", member_id: "member-1", status: "open", assigned_to: null }),
      respond: vi.fn().mockResolvedValue({ id: "response-1" }),
      update: vi.fn(),
    };
    const memberDirectory = { find: vi.fn().mockResolvedValue({ user_id: "member-user-1" }) };
    const notificationPublisher = { notifyMember: vi.fn() };
    await createSupportService({ repository, memberDirectory, notificationPublisher, auditService: { record: vi.fn() } })
      .respond("ticket-1", { body: "Chúng tôi đã tiếp nhận.", status: "in_progress" }, { id: "staff-1", role: "receptionist" });
    expect(memberDirectory.find).toHaveBeenCalledWith("member-1");
    expect(notificationPublisher.notifyMember).toHaveBeenCalledWith("member-user-1", expect.objectContaining({ title: "Phản hồi yêu cầu SUP-01" }));
  });
});
