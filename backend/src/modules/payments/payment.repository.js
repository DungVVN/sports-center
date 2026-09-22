import { prisma } from "../../database.js";
export const paymentRepository = {
  list: (filters) => prisma.payments.findMany({ where: filters, orderBy: { created_at: "desc" } }), memberByUser: (userId) => prisma.members.findUnique({ where: { user_id: userId }, select: { id: true } }), payment: (id) => prisma.payments.findUnique({ where: { id } }), paymentEvents: (paymentId) => prisma.payment_events.findMany({ where: { payment_id: paymentId }, orderBy: { occurred_at: "asc" } }), membership: (id) => prisma.member_memberships.findUnique({ where: { id } }), member: (id) => prisma.members.findUnique({ where: { id } }),
  async listWithDetails(filters) {
    const payments = await this.list(filters);
    if (!payments.length) return [];
    const memberIds = [...new Set(payments.map((payment) => payment.member_id))];
    const membershipIds = [...new Set(payments.map((payment) => payment.membership_id).filter(Boolean))];
    const [members, memberships] = await Promise.all([
      prisma.members.findMany({ where: { id: { in: memberIds } }, select: { id: true, full_name: true, member_code: true, phone: true, email: true } }),
      membershipIds.length
        ? prisma.member_memberships.findMany({ where: { id: { in: membershipIds } }, select: { id: true, package_name_snapshot: true, status: true, expires_on: true } })
        : [],
    ]);
    const memberById = new Map(members.map((member) => [member.id, member]));
    const membershipById = new Map(memberships.map((membership) => [membership.id, membership]));
    return payments.map((payment) => ({
      ...payment,
      member: memberById.get(payment.member_id) ?? null,
      membership: payment.membership_id ? membershipById.get(payment.membership_id) ?? null : null,
    }));
  },
  createWithEvent: (data, event) => prisma.$transaction(async (tx) => { const payment = await tx.payments.create({ data }); await tx.payment_events.create({ data: { ...event, payment_id: payment.id, amount_vnd: payment.amount_vnd } }); return payment; }),
  paymentByCode: (transactionCode) => prisma.payments.findUnique({ where: { transaction_code: transactionCode } }),
  paymentByProviderOrderCode: (providerOrderCode) => prisma.payments.findUnique({ where: { provider_order_code: BigInt(providerOrderCode) } }),
  complete: ({ id, status, paidAt, eventType, actorUserId, membershipId }) => prisma.$transaction(async (tx) => { const changed = await tx.payments.updateMany({ where: { id, status: "pending" }, data: { status, ...(paidAt && { paid_at: paidAt }) } }); if (changed.count !== 1) return null; const payment = await tx.payments.findUnique({ where: { id } }); await tx.payment_events.create({ data: { payment_id: id, event_type: eventType, previous_status: "pending", new_status: status, amount_vnd: payment.amount_vnd, actor_user_id: actorUserId } }); if (status === "paid" && membershipId) { await tx.member_memberships.update({ where: { id: membershipId }, data: { status: "active", activated_at: new Date(), activation_payment_id: id } }); const member = await tx.members.findUnique({ where: { id: payment.member_id }, select: { user_id: true } }); if (member?.user_id) await tx.notifications.create({ data: { recipient_user_id: member.user_id, category: "finance", title: "Thanh toán thành công", body: "Gói tập của bạn đã được kích hoạt sau khi thanh toán thành công.", link_path: `/memberships/${membershipId}` } }); } return payment; }),
};
