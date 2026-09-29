import { prisma } from "../../../database.js";

export const notificationPublisher = {
  notifyMember: (userId, data) => prisma.notifications.create({
    data: { recipient_user_id: userId, category: "member", ...data },
  }),
};
