import { randomUUID } from "node:crypto";
import { prisma } from "../../../database.js";
import { AppError } from "../../../shared/errors/app-error.js";

const invalid = (code, message, statusCode = 422) => new AppError({ code, message, statusCode });
const audit = (tx, actor, action, id, summary, reason) =>
  tx.audit_logs.create({
    data: { actor_user_id: actor.id, action, entity_type: "pt_purchase", entity_id: id, summary, reason },
  });
async function notifyCustomer(tx, memberId, title, body) {
  const member = await tx.members.findUnique({ where: { id: memberId }, select: { user_id: true } });
  if (member?.user_id)
    await tx.notifications.create({
      data: { recipient_user_id: member.user_id, category: "operations", title, body, link_path: "/pt" },
    });
}
async function lockPurchase(tx, id, actor, { coach = false } = {}) {
  await tx.$queryRaw`SELECT id FROM pt_purchases WHERE id = ${id}::uuid FOR UPDATE`;
  const purchase = await tx.pt_purchases.findUnique({ where: { id } });
  if (!purchase) throw invalid("PT_NOT_FOUND", "Không tìm thấy gói PT.", 404);
  if (actor.role === "member") {
    const member = await tx.members.findUnique({ where: { user_id: actor.id } });
    if (purchase.member_id !== member?.id) throw invalid("PT_NOT_FOUND", "Không tìm thấy gói PT của bạn.", 404);
  } else if (actor.role === "coach" && (!coach || purchase.coach_user_id !== actor.id)) {
    throw invalid("PT_SCOPE_DENIED", "Coach chỉ thao tác buổi PT được phân công.", 403);
  }
  return purchase;
}
export async function activatePtPurchase(tx, payment) {
  await tx.$queryRaw`SELECT id FROM pt_purchases WHERE id = ${payment.pt_purchase_id}::uuid FOR UPDATE`;
  const purchase = await tx.pt_purchases.findUnique({ where: { id: payment.pt_purchase_id } });
  if (
    !purchase ||
    purchase.status !== "pending_payment" ||
    purchase.member_id !== payment.member_id ||
    purchase.price_vnd_snapshot !== payment.amount_vnd
  )
    throw invalid("PT_PAYMENT_NOT_ELIGIBLE", "Gói PT không còn chờ thanh toán.");
  const now = new Date();
  await tx.pt_purchases.update({
    where: { id: purchase.id },
    data: {
      status: "active",
      activated_at: now,
      expires_at: new Date(now.getTime() + purchase.duration_days_snapshot * 86400000),
      activation_payment_id: payment.id,
    },
  });
  await notifyCustomer(
    tx,
    purchase.member_id,
    "Đã kích hoạt gói PT",
    "Gói PT đã thanh toán. Trung tâm sẽ phân công coach để bạn đặt lịch.",
  );
}

export const ptRepository = {
  packages: (staff) =>
    prisma.pt_packages.findMany({ where: staff ? undefined : { is_active: true }, orderBy: { created_at: "desc" } }),
  createPackage: (data) => prisma.pt_packages.create({ data }),
  async setPackageActive(id, isActive, actor) {
    return prisma.$transaction(async (tx) => {
      const pack = await tx.pt_packages.findUnique({ where: { id } });
      if (!pack) throw invalid("PT_PACKAGE_NOT_FOUND", "Không tìm thấy gói PT.", 404);
      const result = await tx.pt_packages.update({ where: { id }, data: { is_active: isActive } });
      await audit(
        tx,
        actor,
        "pt.package_availability_changed",
        id,
        isActive ? "Đã mở bán gói PT." : "Đã dừng bán gói PT; gói đã mua giữ nguyên quyền lợi.",
      );
      return result;
    });
  },
  async cancelPurchase(id, actor) {
    return prisma.$transaction(async (tx) => {
      const purchase = await lockPurchase(tx, id, actor);
      if (
        purchase.status !== "pending_payment" ||
        (await tx.payments.count({ where: { pt_purchase_id: id, status: { in: ["pending", "paid"] } } }))
      )
        throw invalid(
          "PT_PURCHASE_NOT_CANCELLABLE",
          "Chỉ hủy đăng ký chưa có giao dịch đang xử lý hoặc đã thanh toán. Liên hệ trung tâm để đối soát giao dịch.",
          409,
        );
      const result = await tx.pt_purchases.update({ where: { id }, data: { status: "cancelled" } });
      await audit(tx, actor, "pt.purchase_cancelled", id, "Đã hủy đăng ký PT chưa thanh toán.");
      return result;
    });
  },
  memberByUser: (userId) => prisma.members.findUnique({ where: { user_id: userId } }),
  purchase: (id) => prisma.pt_purchases.findUnique({ where: { id } }),
  openPayment: (id) =>
    prisma.payments.findFirst({ where: { pt_purchase_id: id, status: { in: ["pending", "paid"] } } }),
  resources: async () => ({
    rooms: await prisma.rooms.findMany({ where: { is_active: true }, select: { id: true, name: true } }),
    coaches: await prisma.users.findMany({
      where: { role: "coach", status: "active" },
      select: { id: true, display_name: true },
    }),
  }),
  async list(actor) {
    let where;
    if (actor.role === "member") {
      const member = await this.memberByUser(actor.id);
      where = { member_id: member?.id ?? "00000000-0000-0000-0000-000000000000" };
    } else if (actor.role === "coach") where = { coach_user_id: actor.id };
    const purchases = await prisma.pt_purchases.findMany({ where, orderBy: { purchased_at: "desc" } });
    const appointments = await prisma.pt_appointments.findMany({
      where: { purchase_id: { in: purchases.map((item) => item.id) } },
      orderBy: { created_at: "asc" },
    });
    const sessions = await prisma.class_sessions.findMany({
      where: { id: { in: appointments.map((item) => item.class_session_id) } },
    });
    const byId = new Map(sessions.map((item) => [item.id, item]));
    return purchases.map((item) => {
      const own = appointments
        .filter((appointment) => appointment.purchase_id === item.id)
        .map((appointment) => ({ ...appointment, session: byId.get(appointment.class_session_id) }));
      return {
        ...item,
        appointments: own,
        remainingSessions:
          item.session_count_snapshot - own.filter((appointment) => appointment.status !== "cancelled").length,
        usedSessions: own.filter((appointment) => ["completed", "absent"].includes(appointment.status)).length,
      };
    });
  },
  async buy(id, memberId, actor) {
    return prisma.$transaction(async (tx) => {
      const pack = await tx.pt_packages.findUnique({ where: { id } });
      if (!pack?.is_active) throw invalid("PT_PACKAGE_UNAVAILABLE", "Gói PT không còn được bán.");
      const free = pack.price_vnd === 0n;
      const now = new Date();
      const result = await tx.pt_purchases.create({
        data: {
          package_id: id,
          member_id: memberId,
          package_name_snapshot: pack.name,
          price_vnd_snapshot: pack.price_vnd,
          session_count_snapshot: pack.session_count,
          duration_days_snapshot: pack.duration_days,
          session_minutes_snapshot: pack.session_minutes,
          cancellation_hours_snapshot: pack.cancellation_hours,
          ...(free && {
            status: "active",
            activated_at: now,
            expires_at: new Date(now.getTime() + pack.duration_days * 86400000),
          }),
        },
      });
      await audit(tx, actor, "pt.purchased", result.id, "Đã đăng ký gói PT theo giá, số buổi và hạn dùng đã chốt.");
      return result;
    });
  },
  async assign(id, coachId, actor) {
    return prisma.$transaction(async (tx) => {
      const purchase = await lockPurchase(tx, id, actor);
      if (purchase.status !== "active") throw invalid("PT_NOT_ACTIVE", "Chỉ phân công coach cho gói PT đã kích hoạt.");
      if (!(await tx.users.findFirst({ where: { id: coachId, role: "coach", status: "active" } })))
        throw invalid("COACH_NOT_AVAILABLE", "Coach không khả dụng.");
      if (await tx.pt_appointments.count({ where: { purchase_id: id, status: "scheduled" } }))
        throw invalid("PT_HAS_SCHEDULED_APPOINTMENTS", "Cần xử lý lịch PT đã đặt trước khi đổi coach.");
      const result = await tx.pt_purchases.update({ where: { id }, data: { coach_user_id: coachId } });
      await audit(tx, actor, "pt.coach_assigned", id, "Đã phân công coach phụ trách gói PT.");
      await notifyCustomer(
        tx,
        purchase.member_id,
        "Đã phân công coach PT",
        "Bạn có thể đặt lịch PT trong hạn dùng của gói.",
      );
      return result;
    });
  },
  async book(id, input, actor) {
    return prisma.$transaction(async (tx) => {
      const purchase = await lockPurchase(tx, id, actor);
      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(startsAt.getTime() + purchase.session_minutes_snapshot * 60000);
      if (
        purchase.status !== "active" ||
        !purchase.coach_user_id ||
        startsAt <= new Date() ||
        endsAt > purchase.expires_at
      )
        throw invalid("PT_NOT_ELIGIBLE", "PT phải đã thanh toán, được phân công coach và còn hạn cho lịch này.");
      if (
        !(await tx.rooms.findFirst({ where: { id: input.roomId, is_active: true } })) ||
        !(await tx.users.findFirst({ where: { id: purchase.coach_user_id, status: "active", role: "coach" } }))
      )
        throw invalid("PT_RESOURCE_UNAVAILABLE", "Phòng hoặc coach không khả dụng.");
      const reserved = await tx.pt_appointments.count({ where: { purchase_id: id, status: { not: "cancelled" } } });
      if (reserved >= purchase.session_count_snapshot)
        throw invalid("PT_BALANCE_EXHAUSTED", "Không còn buổi PT chưa sử dụng hoặc chưa đặt.");
      const session = await tx.class_sessions.create({
        data: {
          code: `PT-${randomUUID()}`,
          name: "Huấn luyện cá nhân",
          type: "personal",
          coach_user_id: purchase.coach_user_id,
          room_id: input.roomId,
          starts_at: startsAt,
          ends_at: endsAt,
          capacity: 1,
          status: "published",
          pt_purchase_id: id,
          created_by: actor.id,
        },
      });
      const appointment = await tx.pt_appointments.create({ data: { purchase_id: id, class_session_id: session.id } });
      await tx.bookings.create({
        data: {
          booking_code: `PT-${randomUUID()}`,
          member_id: purchase.member_id,
          class_session_id: session.id,
          booked_by: actor.id,
          status: "confirmed",
        },
      });
      await audit(tx, actor, "pt.appointment_booked", id, "Đã giữ một buổi PT và đặt lịch coach/phòng.");
      await tx.notifications.create({
        data: {
          recipient_user_id: purchase.coach_user_id,
          category: "operations",
          title: "Có lịch PT mới",
          body: "Một buổi huấn luyện cá nhân đã được đặt trong lịch PT của bạn.",
          link_path: "/pt",
        },
      });
      return { ...appointment, session };
    });
  },
  appointment: (id) => prisma.pt_appointments.findUnique({ where: { id } }),
  async finish(id, input, actor) {
    return prisma.$transaction(async (tx) => {
      const initial = await tx.pt_appointments.findUnique({ where: { id } });
      if (!initial) throw invalid("PT_APPOINTMENT_NOT_FOUND", "Không tìm thấy lịch PT.", 404);
      const purchase = await lockPurchase(tx, initial.purchase_id, actor, { coach: input.status !== "cancelled" });
      const appointment = await tx.pt_appointments.findUnique({ where: { id } });
      if (appointment.status !== "scheduled")
        throw invalid("PT_APPOINTMENT_ALREADY_FINAL", "Buổi PT đã được xử lý.", 409);
      await tx.$queryRaw`SELECT id FROM class_sessions WHERE id = ${appointment.class_session_id}::uuid FOR UPDATE`;
      const session = await tx.class_sessions.findUnique({ where: { id: appointment.class_session_id } });
      const cancelled = input.status === "cancelled";
      const now = new Date();
      if (
        cancelled &&
        actor.role === "member" &&
        session.starts_at.getTime() - now.getTime() < purchase.cancellation_hours_snapshot * 3600000
      )
        throw invalid("PT_CANCELLATION_TOO_LATE", "Đã quá hạn tự hủy theo điều kiện gói PT.");
      if (!cancelled && now < session.starts_at)
        throw invalid("PT_NOT_STARTED", "Chỉ ghi nhận kết quả khi buổi PT đã bắt đầu.");
      const result = await tx.pt_appointments.update({
        where: { id },
        data: {
          status: input.status,
          completed_at: cancelled ? null : now,
          recorded_by: actor.id,
          reason: input.reason,
        },
      });
      await tx.class_sessions.update({
        where: { id: session.id },
        data: { status: cancelled ? "cancelled" : "completed" },
      });
      await tx.bookings.updateMany({
        where: { class_session_id: session.id, status: "confirmed" },
        data: cancelled
          ? { status: "cancelled", cancelled_at: now, cancel_reason: input.reason }
          : { status: input.status === "completed" ? "attended" : "absent" },
      });
      if (!cancelled) {
        const booking = await tx.bookings.findFirst({
          where: { class_session_id: session.id, member_id: purchase.member_id },
        });
        await tx.attendance_records.upsert({
          where: { class_session_id_member_id: { class_session_id: session.id, member_id: purchase.member_id } },
          create: {
            class_session_id: session.id,
            member_id: purchase.member_id,
            booking_id: booking.id,
            status: input.status === "completed" ? "present" : "absent",
            recorded_by: actor.id,
          },
          update: { status: input.status === "completed" ? "present" : "absent", recorded_by: actor.id },
        });
      }
      await audit(
        tx,
        actor,
        cancelled ? "pt.appointment_cancelled" : "pt.appointment_completed",
        purchase.id,
        cancelled ? "Đã hủy lịch và trả lại buổi PT." : "Đã ghi nhận kết quả và sử dụng một buổi PT.",
        input.reason,
      );
      await notifyCustomer(
        tx,
        purchase.member_id,
        cancelled ? "Đã hủy lịch PT" : "Đã ghi nhận buổi PT",
        cancelled
          ? "Lịch đã hủy và số buổi được trả lại vào gói PT."
          : "Kết quả buổi tập đã được lưu; bạn có thể xem điểm danh và tiến độ.",
      );
      return result;
    });
  },
};
