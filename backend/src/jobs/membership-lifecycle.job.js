import { prisma } from "../database.js";

const dayStart = (value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const plusHours = (value, hours) => new Date(value.getTime() + hours * 60 * 60 * 1000);

async function notifyMember(database, memberId, title, body, linkPath) {
  const member = await database.members.findUnique({ where: { id: memberId }, select: { user_id: true } });
  if (!member?.user_id) return;
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const duplicate = await database.notifications.findFirst({ where: { recipient_user_id: member.user_id, title, created_at: { gte: since } } });
  if (!duplicate) await database.notifications.create({ data: { recipient_user_id: member.user_id, category: "member", title, body, link_path: linkPath } });
}

async function applyScheduledFreezes(database, today) {
  const activeRequests = await database.membership_freeze_requests.findMany({ where: { status: "approved", starts_on: { lte: today }, ends_on: { gt: today } }, select: { membership_id: true } });
  const completedRequests = await database.membership_freeze_requests.findMany({ where: { status: "approved", ends_on: { lte: today } }, select: { membership_id: true } });
  const startingIds = [...new Set(activeRequests.map((item) => item.membership_id))];
  const endingIds = [...new Set(completedRequests.map((item) => item.membership_id))];
  if (startingIds.length) await database.member_memberships.updateMany({ where: { id: { in: startingIds }, status: { in: ["active", "expiring_soon"] } }, data: { status: "frozen" } });
  if (endingIds.length) await database.member_memberships.updateMany({ where: { id: { in: endingIds }, status: "frozen" }, data: { status: "active" } });
  return { started: startingIds.length, ended: endingIds.length };
}

export async function runMembershipLifecycleJob(now = new Date(), database = prisma) {
  const today = dayStart(now);
  const sevenDays = new Date(today); sevenDays.setUTCDate(sevenDays.getUTCDate() + 7);
  const freezes = await applyScheduledFreezes(database, today);
  const expiring = await database.member_memberships.findMany({ where: { status: "active", expires_on: { gte: today, lte: sevenDays } } });
  for (const membership of expiring) { await database.member_memberships.update({ where: { id: membership.id }, data: { status: "expiring_soon" } }); await notifyMember(database, membership.member_id, "Gói tập sắp hết hạn", "Gói tập của bạn sắp hết hạn. Hãy gia hạn để không gián đoạn quyền sử dụng.", `/memberships/${membership.id}`); }
  const expiredToday = await database.member_memberships.findMany({ where: { status: { in: ["active", "expiring_soon"] }, expires_on: { lt: today }, grace_expires_at: null } });
  for (const membership of expiredToday) { await database.member_memberships.update({ where: { id: membership.id }, data: { grace_expires_at: plusHours(new Date(membership.expires_on), 72), status: "expiring_soon" } }); await notifyMember(database, membership.member_id, "Gói tập đã hết hạn", "Bạn vẫn có 72 giờ để gia hạn mà không mất thêm phí.", `/memberships/${membership.id}`); }
  const inGrace = await database.member_memberships.findMany({ where: { status: "expiring_soon", grace_expires_at: { gt: now } } });
  for (const membership of inGrace) await notifyMember(database, membership.member_id, "Nhắc gia hạn gói tập", "Gói tập của bạn đang trong thời gian gia hạn 72 giờ. Hãy gia hạn ngay hôm nay.", `/memberships/${membership.id}`);
  const pastGrace = await database.member_memberships.findMany({ where: { status: "expiring_soon", grace_expires_at: { lte: now } } });
  for (const membership of pastGrace) { await database.member_memberships.update({ where: { id: membership.id }, data: { status: "expired" } }); await notifyMember(database, membership.member_id, "Gói tập đã hết hạn chính thức", "Thời gian gia hạn 72 giờ đã kết thúc. Vui lòng mua hoặc gia hạn gói tập để tiếp tục sử dụng.", `/memberships/${membership.id}`); }
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcoming = await database.class_sessions.findMany({ where: { status: "published", starts_at: { gte: now, lte: tomorrow } } });
  for (const session of upcoming) { const bookings = await database.bookings.findMany({ where: { class_session_id: session.id, status: "confirmed" }, select: { member_id: true } }); for (const booking of bookings) await notifyMember(database, booking.member_id, "Nhắc lịch học", `Bạn có lớp ${session.name} lúc ${session.starts_at.toLocaleString("vi-VN")}.`, `/classes/${session.id}`); }
  const absent = await database.attendance_records.findMany({ where: { status: "absent", recorded_at: { gte: today } }, select: { member_id: true, class_session_id: true } });
  for (const record of absent) await notifyMember(database, record.member_id, "Bạn đã vắng buổi học", "Hãy kiểm tra lịch tập và liên hệ Coach nếu cần hỗ trợ.", `/classes/${record.class_session_id}`);
  const stalePlans = await database.training_plans.findMany({ where: { updated_at: { lt: new Date(now.getTime() - 14 * 86400000) }, status: "active" }, select: { id: true, coach_user_id: true } });
  for (const plan of stalePlans) { const duplicate = await database.notifications.findFirst({ where: { recipient_user_id: plan.coach_user_id, title: "Cần cập nhật giáo án", created_at: { gte: new Date(now.getTime() - 20 * 60 * 60 * 1000) } } }); if (!duplicate) await database.notifications.create({ data: { recipient_user_id: plan.coach_user_id, category: "operations", title: "Cần cập nhật giáo án", body: "Một giáo án đang hoạt động chưa được cập nhật trong 14 ngày.", link_path: `/training-plans/${plan.id}` } }); }
  return { expiring: expiring.length, graceStarted: expiredToday.length, expired: pastGrace.length, freezeStarted: freezes.started, freezeEnded: freezes.ended, upcomingClasses: upcoming.length, absences: absent.length, stalePlans: stalePlans.length };
}
