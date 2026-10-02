import { prisma } from "../../../database.js";

export async function expireCourseHolds(now = new Date(), database = prisma) {
  const candidates = await database.course_enrollments.findMany({ where: { status: "pending_payment", payment_expires_at: { lte: now } }, select: { id: true }, take: 100, orderBy: { payment_expires_at: "asc" } });
  let expired = 0;
  for (const candidate of candidates) {
    expired += await database.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM course_enrollments WHERE id=${candidate.id}::uuid FOR UPDATE`;
      const item = await tx.course_enrollments.findUnique({ where: { id: candidate.id } });
      if (item.status !== "pending_payment" || !item.payment_expires_at || item.payment_expires_at > now) return 0;
      await tx.course_enrollments.update({ where: { id: item.id }, data: { status: "cancelled", cancelled_at: now, cancellation_reason: "Hết thời hạn giữ chỗ chờ thanh toán." } });
      const member = await tx.members.findUnique({ where: { id: item.member_id }, select: { user_id: true } });
      if (member?.user_id) await tx.notifications.create({ data: { recipient_user_id: member.user_id, category: "finance", title: "Đăng ký khóa hết thời gian giữ chỗ", body: "Chỗ đã được giải phóng. Không thanh toán giao dịch cũ; nếu tiền đã chuyển, trung tâm sẽ đối soát khoản đã thu.", link_path: "/my/services" } });
      return 1;
    });
  }
  return expired;
}
