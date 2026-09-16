import { prisma } from "../../database.js";
export const supportRepository = {
  memberByUser: (userId) => prisma.members.findUnique({ where: { user_id: userId }, select: { id: true } }),
  tickets: (where) => prisma.support_tickets.findMany({ where, orderBy: { updated_at: "desc" } }),
  ticket: (id) => prisma.support_tickets.findUnique({ where: { id } }),
  create: (data) => prisma.support_tickets.create({ data }),
  update: (id, data) => prisma.support_tickets.update({ where: { id }, data }),
  responses: (ticketId) => prisma.support_ticket_responses.findMany({ where: { ticket_id: ticketId }, orderBy: { created_at: "asc" } }),
  respond: (data) => prisma.support_ticket_responses.create({ data }),
};
