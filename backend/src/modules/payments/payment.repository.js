import { prisma } from "../../database.js";
export const paymentRepository = {
  list: (filters) => prisma.payments.findMany({ where: filters, orderBy: { created_at: "desc" } }), payment: (id) => prisma.payments.findUnique({ where: { id } }), membership: (id) => prisma.member_memberships.findUnique({ where: { id } }), member: (id) => prisma.members.findUnique({ where: { id } }),
  create: (data) => prisma.payments.create({ data }),
  mark: (id, status, paidAt) => prisma.payments.update({ where: { id }, data: { status, ...(paidAt && { paid_at: paidAt }) } }),
  event: (data) => prisma.payment_events.create({ data }),
  activateMembership: (id, paymentId) => prisma.member_memberships.update({ where: { id }, data: { status: "active", activated_at: new Date(), activation_payment_id: paymentId } }),
};
