import { prisma } from "../../../database.js";
export const notificationPreferenceRepository = { get: (userId) => prisma.notification_preferences.findUnique({ where: { user_id: userId } }), save: (userId, data) => prisma.notification_preferences.upsert({ where: { user_id: userId }, create: { user_id: userId, ...data }, update: data }) };
