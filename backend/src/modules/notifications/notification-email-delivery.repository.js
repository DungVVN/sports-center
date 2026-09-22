import { prisma } from "../../database.js";

const pendingWhere = (staleBefore) => ({
  email_delivered_at: null,
  email_skipped_at: null,
  email_delivery_attempts: { lt: 5 },
  OR: [{ email_delivery_locked_at: null }, { email_delivery_locked_at: { lt: staleBefore } }],
});

export const notificationEmailDeliveryRepository = {
  async pending({ staleBefore, limit }) {
    const notifications = await prisma.notifications.findMany({ where: pendingWhere(staleBefore), orderBy: { created_at: "asc" }, take: limit });
    if (!notifications.length) return [];
    const userIds = [...new Set(notifications.map((item) => item.recipient_user_id))];
    const [users, preferences] = await Promise.all([
      prisma.users.findMany({ where: { id: { in: userIds }, status: "active" }, select: { id: true, email: true, display_name: true } }),
      prisma.notification_preferences.findMany({ where: { user_id: { in: userIds } }, select: { user_id: true, email_enabled: true } }),
    ]);
    const userById = new Map(users.map((item) => [item.id, item]));
    const preferenceByUserId = new Map(preferences.map((item) => [item.user_id, item]));
    return notifications.map((notification) => ({ ...notification, recipient: userById.get(notification.recipient_user_id) ?? null, emailEnabled: preferenceByUserId.get(notification.recipient_user_id)?.email_enabled ?? true }));
  },
  claim: ({ id, staleBefore, lockedAt }) => prisma.notifications.updateMany({
    where: { id, ...pendingWhere(staleBefore) },
    data: { email_delivery_locked_at: lockedAt, email_delivery_attempts: { increment: 1 }, email_delivery_error: null },
  }),
  delivered: (id, deliveredAt) => prisma.notifications.update({ where: { id }, data: { email_delivered_at: deliveredAt, email_delivery_locked_at: null, email_delivery_error: null } }),
  skipped: (id, skippedAt) => prisma.notifications.update({ where: { id }, data: { email_skipped_at: skippedAt, email_delivery_locked_at: null, email_delivery_error: null } }),
  failed: (id, error) => prisma.notifications.update({ where: { id }, data: { email_delivery_locked_at: null, email_delivery_error: error.slice(0, 500) } }),
};
