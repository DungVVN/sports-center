import { prisma } from "../../../database.js";
export const operationNotificationRepository = {
  async publishForActorAndAdmins(actorUserId, notification) {
    const recipients = await prisma.users.findMany({ where: { status: "active", OR: [{ id: actorUserId }, { role: "admin" }] }, select: { id: true } });
    if (!recipients.length) return;
    await prisma.notifications.createMany({ data: recipients.map(({ id }) => ({ recipient_user_id: id, category: "system", ...notification, email_skipped_at: new Date() })) });
  },
};
