import { prisma } from "../database.js";

const dayStart = (value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const plusHours = (value, hours) => new Date(value.getTime() + hours * 60 * 60 * 1000);

async function notifyMember(memberId, title, body, linkPath) {
  const member = await prisma.members.findUnique({ where: { id: memberId }, select: { user_id: true } });
  if (!member?.user_id) return;
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const duplicate = await prisma.notifications.findFirst({ where: { recipient_user_id: member.user_id, title, created_at: { gte: since } } });
  if (!duplicate) await prisma.notifications.create({ data: { recipient_user_id: member.user_id, category: "member", title, body, link_path: linkPath } });
}

export async function runMembershipLifecycleJob(now = new Date()) {
  const today = dayStart(now); const sevenDays = new Date(today); sevenDays.setUTCDate(sevenDays.getUTCDate() + 7);
  const expiring = await prisma.member_memberships.findMany({ where: { status: "active", expires_on: { gte: today, lte: sevenDays } } });
  for (const membership of expiring) { await prisma.member_memberships.update({ where: { id: membership.id }, data: { status: "expiring_soon" } }); await notifyMember(membership.member_id, "Gói tập sắp hết hạn", "Gói tập của bạn sắp hết hạn. Hãy gia hạn để không gián đoạn quyền sử dụng.", `/memberships/${membership.id}`); }
  const expiredToday = await prisma.member_memberships.findMany({ where: { status: { in: ["active", "expiring_soon"] }, expires_on: { lt: today }, grace_expires_at: null } });
  for (const membership of expiredToday) { await prisma.member_memberships.update({ where: { id: membership.id }, data: { grace_expires_at: plusHours(new Date(membership.expires_on), 72), status: "expiring_soon" } }); await notifyMember(membership.member_id, "Gói tập đã hết hạn", "Bạn vẫn có 72 giờ để gia hạn mà không mất thêm phí.", `/memberships/${membership.id}`); }
  const inGrace = await prisma.member_memberships.findMany({ where: { status: "expiring_soon", grace_expires_at: { gt: now } } });
  for (const membership of inGrace) await notifyMember(membership.member_id, "Nhắc gia hạn gói tập", "Gói tập của bạn đang trong thời gian gia hạn 72 giờ. Hãy gia hạn ngay hôm nay.", `/memberships/${membership.id}`);
  const pastGrace = await prisma.member_memberships.findMany({ where: { status: "expiring_soon", grace_expires_at: { lte: now } } });
  for (const membership of pastGrace) { await prisma.member_memberships.update({ where: { id: membership.id }, data: { status: "expired" } }); await notifyMember(membership.member_id, "Gói tập đã hết hạn chính thức", "Thời gian gia hạn 72 giờ đã kết thúc. Vui lòng mua hoặc gia hạn gói tập để tiếp tục sử dụng.", `/memberships/${membership.id}`); }
  return { expiring: expiring.length, graceStarted: expiredToday.length, expired: pastGrace.length };
}
