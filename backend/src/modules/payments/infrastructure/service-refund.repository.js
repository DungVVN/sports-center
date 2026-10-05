import { prisma } from "../../../database.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { assertServiceRefundPayment } from "../domain/refund-policy.js";
import { activateCourseEnrollment } from "../../courses/index.js";
import { activatePtPurchase } from "../../pt/index.js";
import { activateFacilityReservation } from "../../facilities/index.js";

const fail = (code, message, statusCode = 422) => {
  throw new AppError({ statusCode, code, message });
};
async function event(tx, payment, type, actor, note) {
  await tx.payment_events.create({
    data: {
      payment_id: payment.id,
      event_type: type,
      new_status: payment.status,
      amount_vnd: payment.amount_vnd,
      actor_user_id: actor.id,
      note,
    },
  });
  await tx.audit_logs.create({
    data: {
      actor_user_id: actor.id,
      action: type,
      entity_type: "payment",
      entity_id: payment.id,
      summary: "Đã xử lý hoàn tiền/đối soát dịch vụ trong giao dịch dữ liệu.",
      reason: note,
    },
  });
}
async function lockPayment(tx, id) {
  await tx.$queryRaw`SELECT id FROM payments WHERE id=${id}::uuid FOR UPDATE`;
  const payment = await tx.payments.findUnique({ where: { id } });
  if (!payment) fail("PAYMENT_NOT_FOUND", "Không tìm thấy giao dịch.", 404);
  return payment;
}
async function notify(tx, payment, title, body) {
  const member = await tx.members.findUnique({ where: { id: payment.member_id }, select: { user_id: true } });
  if (member?.user_id)
    await tx.notifications.create({
      data: { recipient_user_id: member.user_id, category: "finance", title, body, link_path: "/my/payments" },
    });
}
async function unusedService(tx, payment) {
  assertServiceRefundPayment(payment);
  const now = new Date();
  if (payment.course_enrollment_id) {
    await tx.$queryRaw`SELECT id FROM course_enrollments WHERE id=${payment.course_enrollment_id}::uuid FOR UPDATE`;
    const enrollment = await tx.course_enrollments.findUnique({ where: { id: payment.course_enrollment_id } });
    await tx.$queryRaw`SELECT id FROM class_sessions WHERE course_id=${enrollment.course_id}::uuid ORDER BY id FOR UPDATE`;
    const sessions = await tx.class_sessions.findMany({
      where: { course_id: enrollment.course_id },
      select: { id: true, starts_at: true },
    });
    const bookings = await tx.bookings.findMany({
      where: { member_id: payment.member_id, class_session_id: { in: sessions.map((item) => item.id) } },
    });
    if (
      bookings.some(
        (booking) =>
          ["attended", "absent"].includes(booking.status) ||
          (booking.status === "confirmed" &&
            sessions.find((item) => item.id === booking.class_session_id).starts_at <= now),
      ) ||
      (await tx.attendance_records.count({
        where: { member_id: payment.member_id, class_session_id: { in: sessions.map((item) => item.id) } },
      }))
    )
      fail("SERVICE_ALREADY_USED", "Khóa đã có buổi sử dụng/điểm danh; không đủ điều kiện hoàn toàn bộ.");
    return { type: "course", enrollment, sessions };
  }
  if (payment.pt_purchase_id) {
    await tx.$queryRaw`SELECT id FROM pt_purchases WHERE id=${payment.pt_purchase_id}::uuid FOR UPDATE`;
    const purchase = await tx.pt_purchases.findUnique({ where: { id: payment.pt_purchase_id } });
    await tx.$queryRaw`SELECT id FROM class_sessions WHERE pt_purchase_id=${purchase.id}::uuid ORDER BY id FOR UPDATE`;
    const appointments = await tx.pt_appointments.findMany({ where: { purchase_id: purchase.id } });
    const sessions = await tx.class_sessions.findMany({ where: { pt_purchase_id: purchase.id } });
    if (
      appointments.some(
        (item) =>
          ["completed", "absent"].includes(item.status) ||
          (item.status === "scheduled" &&
            sessions.find((session) => session.id === item.class_session_id).starts_at <= now),
      )
    )
      fail("SERVICE_ALREADY_USED", "Gói PT đã có buổi sử dụng; không đủ điều kiện hoàn toàn bộ.");
    return { type: "pt", purchase, appointments, sessions };
  }
  await tx.$queryRaw`SELECT id FROM facility_reservations WHERE id=${payment.facility_reservation_id}::uuid FOR UPDATE`;
  const rental = await tx.facility_reservations.findUnique({ where: { id: payment.facility_reservation_id } });
  const day = await tx.facility_days.findUnique({ where: { id: rental.day_id } });
  const start =
    new Date(`${day.open_on.toISOString().slice(0, 10)}T00:00:00+07:00`).getTime() +
    rental.assigned_start_minute * 60_000;
  if (rental.completed_at || (rental.status === "approved" && start <= now && !payment.fulfillment_error))
    fail("SERVICE_ALREADY_USED", "Khung giờ đã bắt đầu hoặc đã chốt sử dụng; không đủ điều kiện hoàn toàn bộ.");
  return { type: "facility", rental };
}
async function revoke(tx, payment, service, actor, reason) {
  const now = new Date();
  if (service.type === "course") {
    await tx.bookings.updateMany({
      where: {
        member_id: payment.member_id,
        class_session_id: { in: service.sessions.map((item) => item.id) },
        status: { in: ["confirmed", "waitlisted"] },
      },
      data: { status: "cancelled", cancelled_at: now, cancel_reason: reason },
    });
    await tx.course_enrollments.update({
      where: { id: service.enrollment.id },
      data: { status: "cancelled", cancelled_at: now, cancellation_reason: reason },
    });
  } else if (service.type === "pt") {
    await tx.pt_appointments.updateMany({
      where: { purchase_id: service.purchase.id, status: "scheduled" },
      data: { status: "cancelled", reason, recorded_by: actor.id },
    });
    await tx.bookings.updateMany({
      where: { class_session_id: { in: service.sessions.map((item) => item.id) }, status: "confirmed" },
      data: { status: "cancelled", cancelled_at: now, cancel_reason: reason },
    });
    await tx.class_sessions.updateMany({
      where: { pt_purchase_id: service.purchase.id, status: "published" },
      data: { status: "cancelled" },
    });
    await tx.pt_purchases.update({ where: { id: service.purchase.id }, data: { status: "cancelled" } });
  } else {
    await tx.facility_reservations.update({
      where: { id: service.rental.id },
      data: { status: "cancelled", cancelled_at: now, cancelled_by: actor.id, decision_reason: reason },
    });
  }
}

export const serviceRefundRepository = {
  refunds: async (actor) => {
    const member = actor.role === "member" ? await prisma.members.findUnique({ where: { user_id: actor.id } }) : null;
    return prisma.service_refunds.findMany({
      where: actor.role === "member" ? { member_id: member?.id ?? "00000000-0000-0000-0000-000000000000" } : undefined,
      orderBy: { requested_at: "desc" },
    });
  },
  requestRefund: (id, reason, actor) =>
    prisma.$transaction(async (tx) => {
      const payment = await lockPayment(tx, id);
      if (
        actor.role === "member" &&
        !(await tx.members.findFirst({ where: { id: payment.member_id, user_id: actor.id } }))
      )
        fail("PAYMENT_NOT_FOUND", "Không tìm thấy giao dịch của bạn.", 404);
      await unusedService(tx, payment);
      if (
        await tx.service_refunds.findFirst({
          where: { payment_id: id, status: { in: ["pending", "approved", "completed"] } },
        })
      )
        fail("REFUND_ALREADY_EXISTS", "Giao dịch đã có yêu cầu hoàn tiền đang xử lý hoặc hoàn tất.", 409);
      const refund = await tx.service_refunds.create({
        data: {
          payment_id: id,
          member_id: payment.member_id,
          amount_vnd: payment.amount_vnd,
          reason,
          requested_by: actor.id,
        },
      });
      await event(tx, payment, "service_refund_requested", actor, reason);
      return refund;
    }),
  reviewRefund: (id, approved, note, actor) =>
    prisma.$transaction(async (tx) => {
      const initial = await tx.service_refunds.findUnique({ where: { id } });
      if (!initial) fail("REFUND_NOT_FOUND", "Không tìm thấy yêu cầu hoàn tiền.", 404);
      const payment = await lockPayment(tx, initial.payment_id);
      await tx.$queryRaw`SELECT id FROM service_refunds WHERE id=${id}::uuid FOR UPDATE`;
      const refund = await tx.service_refunds.findUnique({ where: { id } });
      if (refund.status !== "pending") fail("REFUND_ALREADY_REVIEWED", "Yêu cầu đã được xử lý.", 409);
      if (approved) await revoke(tx, payment, await unusedService(tx, payment), actor, note);
      const result = await tx.service_refunds.update({
        where: { id },
        data: {
          status: approved ? "approved" : "rejected",
          reviewed_by: actor.id,
          reviewed_at: new Date(),
          review_note: note,
        },
      });
      await event(tx, payment, approved ? "service_refund_approved" : "service_refund_rejected", actor, note);
      await notify(
        tx,
        payment,
        approved ? "Hoàn tiền đã được duyệt" : "Yêu cầu hoàn tiền bị từ chối",
        approved
          ? "Quyền sử dụng dịch vụ đã đóng. Nhân viên sẽ đối soát việc trả tiền; chưa ghi nhận hoàn tiền cho đến khi thực hiện."
          : note,
      );
      return result;
    }),
  executeRefund: (id, reference, actor) =>
    prisma.$transaction(async (tx) => {
      const initial = await tx.service_refunds.findUnique({ where: { id } });
      if (!initial) fail("REFUND_NOT_FOUND", "Không tìm thấy yêu cầu hoàn tiền.", 404);
      const payment = await lockPayment(tx, initial.payment_id);
      await tx.$queryRaw`SELECT id FROM service_refunds WHERE id=${id}::uuid FOR UPDATE`;
      const refund = await tx.service_refunds.findUnique({ where: { id } });
      if (refund.status !== "approved" || payment.status !== "paid")
        fail("REFUND_NOT_EXECUTABLE", "Chỉ xác nhận đã trả tiền cho yêu cầu được duyệt và chưa hoàn.", 409);
      const result = await tx.service_refunds.update({
        where: { id },
        data: { status: "completed", executed_by: actor.id, executed_at: new Date(), transfer_reference: reference },
      });
      await tx.payments.update({ where: { id: payment.id }, data: { status: "refunded", fulfillment_error: null } });
      if (payment.facility_reservation_id)
        await tx.facility_reservations.update({
          where: { id: payment.facility_reservation_id },
          data: { payment_state: "refunded" },
        });
      await event(tx, { ...payment, status: "refunded" }, "service_refund_executed", actor, reference);
      await notify(
        tx,
        payment,
        "Đã xác nhận hoàn tiền",
        `Trung tâm đã đối soát hoàn toàn bộ ${refund.amount_vnd.toString()} đ. Mã đối soát: ${reference}`,
      );
      return result;
    }),
  reconcile: (id, note, actor) =>
    prisma.$transaction(async (tx) => {
      const payment = await lockPayment(tx, id);
      if (payment.status !== "paid" || !payment.fulfillment_error)
        fail("PAYMENT_NOT_RECONCILABLE", "Chỉ đối soát giao dịch đã thu và đang lỗi cấp quyền.");
      if (
        await tx.service_refunds.count({
          where: { payment_id: id, status: { in: ["pending", "approved", "completed"] } },
        })
      )
        fail("PAYMENT_REFUND_IN_PROGRESS", "Cần xử lý yêu cầu hoàn tiền trước khi cấp lại dịch vụ.");
      if (payment.course_enrollment_id) await activateCourseEnrollment(tx, payment);
      else if (payment.pt_purchase_id) await activatePtPurchase(tx, payment);
      else if (payment.facility_reservation_id) await activateFacilityReservation(tx, payment);
      else fail("PAYMENT_NOT_RECONCILABLE", "Giao dịch không có dịch vụ hỗ trợ đối soát.");
      const result = await tx.payments.update({ where: { id }, data: { fulfillment_error: null } });
      await event(tx, payment, "service_activation_reconciled", actor, note);
      return result;
    }),
};
