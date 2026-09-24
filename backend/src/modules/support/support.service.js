import { randomBytes } from "node:crypto";
import { AppError } from "../../shared/errors/app-error.js";
import { violatesUniqueConstraint, retryOnUniqueConstraint } from "../../shared/database/unique-constraint.js";

export function createSupportService({ repository, auditService }) {
  const member = async (actor) => {
    const item = await repository.memberByUser(actor.id);
    if (!item) throw new AppError({ statusCode: 404, code: "MEMBER_PROFILE_NOT_FOUND", message: "Không tìm thấy hồ sơ hội viên." });
    return item;
  };
  const accessible = async (id, actor) => {
    const ticket = await repository.ticket(id);
    if (!ticket) throw new AppError({ statusCode: 404, code: "SUPPORT_TICKET_NOT_FOUND", message: "Không tìm thấy yêu cầu hỗ trợ." });
    if (actor.role === "member" && ticket.member_id !== (await member(actor)).id) throw new AppError({ statusCode: 403, code: "SUPPORT_TICKET_ACCESS_DENIED", message: "Bạn chỉ xem yêu cầu của mình." });
    return ticket;
  };
  return {
    async list(actor) { return repository.tickets(actor.role === "member" ? { member_id: (await member(actor)).id } : {}); },
    async create(input, actor) {
      const memberProfile = await member(actor);
      let item;
      try {
        item = await retryOnUniqueConstraint(() => repository.create({ ticket_code: `SUP-${randomBytes(4).toString("hex").toUpperCase()}`, member_id: memberProfile.id, subject: input.subject, body: input.body, priority: input.priority ?? "normal" }), { fields: ["ticket_code"] });
      } catch (error) {
        if (violatesUniqueConstraint(error)) throw new AppError({ statusCode: 409, code: "SUPPORT_TICKET_CONFLICT", message: "Không thể tạo mã yêu cầu hỗ trợ. Vui lòng thử lại." });
        throw error;
      }
      await auditService.record({ actorUserId: actor.id, action: "support.created", entityType: "support_ticket", entityId: item.id, summary: "Đã gửi yêu cầu hỗ trợ." });
      return item;
    },
    async detail(id, actor) { await accessible(id, actor); return { ticket: await repository.ticket(id), responses: await repository.responses(id) }; },
    async assignSelf(id, actor) {
      const ticket = await accessible(id, actor);
      const updated = await repository.update(id, { assigned_to: actor.id, status: ticket.status === "open" ? "in_progress" : ticket.status });
      await auditService.record({ actorUserId: actor.id, action: "support.assigned", entityType: "support_ticket", entityId: id, summary: "Đã nhận phụ trách yêu cầu hỗ trợ." });
      return updated;
    },
    async respond(id, input, actor) {
      const ticket = await accessible(id, actor);
      const response = await repository.respond({ ticket_id: id, author_user_id: actor.id, body: input.body });
      await repository.update(id, { assigned_to: ticket.assigned_to ?? actor.id, ...(input.status && { status: input.status }) });
      const memberUserId = await repository.memberUserId(ticket.member_id);
      if (memberUserId) await repository.notifyUser(memberUserId, { title: `Phản hồi yêu cầu ${ticket.ticket_code}`, body: input.body, link_path: `/support/${id}` });
      await auditService.record({ actorUserId: actor.id, action: "support.responded", entityType: "support_ticket", entityId: id, summary: "Đã phản hồi yêu cầu hỗ trợ." });
      return { ticket, response };
    },
  };
}
