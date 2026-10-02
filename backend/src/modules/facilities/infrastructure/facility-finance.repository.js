import { prisma } from "../../../database.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { rentalInstant } from "../domain/rental-policy.js";

const fail = (code, message, statusCode = 422) => { throw new AppError({ statusCode, code, message }); };

export async function activateFacilityReservation(tx, payment) {
  await tx.$queryRaw`SELECT id FROM facility_reservations WHERE id=${payment.facility_reservation_id}::uuid FOR UPDATE`;
  const reservation = await tx.facility_reservations.findUnique({ where: { id: payment.facility_reservation_id } });
  const member = await tx.members.findUnique({ where: { id: payment.member_id }, select: { user_id: true } });
  const day = reservation && await tx.facility_days.findUnique({ where: { id: reservation.day_id } });
  if (!reservation || reservation.status !== "approved" || reservation.payment_state !== "unpaid"
    || reservation.requester_user_id !== member?.user_id || reservation.total_vnd_snapshot !== payment.amount_vnd
    || rentalInstant(day.open_on.toISOString().slice(0, 10), reservation.assigned_end_minute) <= new Date()) {
    fail("FACILITY_PAYMENT_NOT_ELIGIBLE", "Đơn đặt sân không còn đủ điều kiện cấp quyền; cần đối soát khoản tiền đã thu.");
  }
  await tx.facility_reservations.update({ where: { id: reservation.id }, data: { payment_state: "paid", activation_payment_id: payment.id } });
  await tx.notifications.create({ data: { recipient_user_id: reservation.requester_user_id, category: "finance", title: "Đặt sân đã thanh toán", body: "Bạn đã thanh toán đơn đặt sân theo giờ và mức giá đã duyệt.", link_path: "/facilities" } });
}

export const facilityFinanceRepository = {
  memberByUser: (userId) => prisma.members.findUnique({ where: { user_id: userId } }),
  openPayment: (id) => prisma.payments.findFirst({ where: { facility_reservation_id: id, status: { in: ["pending", "paid"] } } }),
  settings: async () => {
    const [facilities, rooms] = await Promise.all([
      prisma.facilities.findMany({ orderBy: { name: "asc" } }),
      prisma.rooms.findMany({ where: { is_active: true }, select: { id: true, name: true } }),
    ]);
    return { facilities: facilities.map((item) => ({ ...item, hourlyRateVnd: item.hourly_rate_vnd?.toString() ?? null })), rooms };
  },
  configure: (id, input, actorUserId) => prisma.$transaction(async (tx) => {
    const item = await tx.facilities.update({ where: { id }, data: { hourly_rate_vnd: BigInt(input.hourlyRateVnd), room_id: input.roomId ?? null } });
    await tx.audit_logs.create({ data: { actor_user_id: actorUserId, action: "facility.configured", entity_type: "facility", entity_id: id, summary: "Đã cấu hình giá theo giờ và phòng vật lý dùng chung; đơn đã duyệt giữ giá cũ." } });
    return { id: item.id, hourlyRateVnd: item.hourly_rate_vnd.toString(), roomId: item.room_id };
  }),
  roomBusy: (roomIds, from, to) => prisma.class_sessions.findMany({ where: { room_id: { in: roomIds }, status: { not: "cancelled" }, starts_at: { lt: to }, ends_at: { gt: from } }, select: { room_id: true, starts_at: true, ends_at: true } }),
  complete: (id, note, actorUserId) => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM facility_reservations WHERE id=${id}::uuid FOR UPDATE`;
    const item = await tx.facility_reservations.findUnique({ where: { id } });
    if (!item) fail("FACILITY_REQUEST_NOT_FOUND", "Không tìm thấy đơn đặt sân.", 404);
    if (item.status !== "approved" || item.completed_at) fail("FACILITY_NOT_COMPLETABLE", "Đơn không còn chờ ghi nhận sử dụng.");
    const day = await tx.facility_days.findUnique({ where: { id: item.day_id } });
    if (rentalInstant(day.open_on.toISOString().slice(0, 10), item.assigned_end_minute) > new Date()) fail("FACILITY_NOT_ENDED", "Chỉ chốt sử dụng sau khi hết khung giờ đã duyệt.");
    if (!["legacy", "free", "paid"].includes(item.payment_state)) fail("FACILITY_PAYMENT_REQUIRED", "Cần xác nhận thanh toán trước khi chốt sử dụng.");
    if (item.payment_state === "paid" && !await tx.payments.findFirst({ where: { id: item.activation_payment_id, status: "paid" } })) fail("FACILITY_PAYMENT_REQUIRED", "Khoản thu đã thay đổi; cần đối soát trước khi chốt sử dụng.");
    const result = await tx.facility_reservations.update({ where: { id }, data: { completed_at: new Date(), completed_by: actorUserId, completion_note: note } });
    await tx.audit_logs.create({ data: { actor_user_id: actorUserId, action: "facility.completed", entity_type: "facility_reservation", entity_id: id, summary: "Đã ghi nhận kết thúc sử dụng sân/phòng.", reason: note } });
    await tx.notifications.create({ data: { recipient_user_id: item.requester_user_id, category: "operations", title: "Đã chốt sử dụng sân/phòng", body: note, link_path: "/facilities" } });
    return { id: result.id, completedAt: result.completed_at };
  }),
};
