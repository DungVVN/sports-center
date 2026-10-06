import { activatePtPurchase } from "../../pt/index.js";
import { activateFacilityReservation } from "../../facilities/index.js";
import { activateCourseEnrollment } from "../../courses/index.js";
import { prisma } from "../../../database.js";
import { serviceRefundRepository } from "./service-refund.repository.js";
import { listPaymentTargets } from "./payment-target.repository.js";
import { selectPaymentPage } from "./payment-page.js";

async function recordPaymentAudit(tx, payment, audit, actorUserId) {
  if (!audit) return;
  await tx.audit_logs.create({ data: {
    actor_user_id: actorUserId,
    action: audit.action,
    entity_type: "payment",
    entity_id: payment.id,
    summary: payment.fulfillment_error ? (audit.reviewSummary ?? audit.summary) : audit.summary,
    ...(audit.reason && { reason: audit.reason }),
  } });
}
export const paymentRepository = {
  targets: listPaymentTargets,
  ...serviceRefundRepository,
  selectPage: selectPaymentPage,
  list: (filters) => prisma.payments.findMany({ where: filters, take: 100, orderBy: [{ created_at: "desc" }, { id: "desc" }] }),
  memberByUser: (userId) => prisma.members.findUnique({ where: { user_id: userId }, select: { id: true } }),
  payment: (id) => prisma.payments.findUnique({ where: { id } }),
  paymentEvents: (paymentId) =>
    prisma.payment_events.findMany({ where: { payment_id: paymentId }, orderBy: { occurred_at: "asc" } }),
  membership: (id) => prisma.member_memberships.findUnique({ where: { id } }),
  member: (id) => prisma.members.findUnique({ where: { id } }),
  async listWithDetails(filters) {
    const payments = await this.list(filters);
    if (!payments.length) return [];
    const memberIds = [...new Set(payments.map((payment) => payment.member_id))];
    const membershipIds = [...new Set(payments.map((payment) => payment.membership_id).filter(Boolean))];
    const enrollmentIds = [...new Set(payments.map((payment) => payment.course_enrollment_id).filter(Boolean))];
    const [members, memberships] = await Promise.all([
      prisma.members.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, full_name: true, member_code: true, phone: true, email: true },
      }),
      membershipIds.length
        ? prisma.member_memberships.findMany({
            where: { id: { in: membershipIds } },
            select: { id: true, package_name_snapshot: true, status: true, expires_on: true },
          })
        : [],
    ]);
    const memberById = new Map(members.map((member) => [member.id, member]));
    const membershipById = new Map(memberships.map((membership) => [membership.id, membership]));
    const enrollments = enrollmentIds.length
      ? await prisma.course_enrollments.findMany({ where: { id: { in: enrollmentIds } } })
      : [];
    const courses = enrollments.length
      ? await prisma.courses.findMany({ where: { id: { in: enrollments.map((item) => item.course_id) } } })
      : [];
    const courseById = new Map(courses.map((course) => [course.id, course]));
    const enrollmentById = new Map(enrollments.map((item) => [item.id, item]));
    const ptIds = [...new Set(payments.map((payment) => payment.pt_purchase_id).filter(Boolean))];
    const ptPurchases = ptIds.length ? await prisma.pt_purchases.findMany({ where: { id: { in: ptIds } } }) : [];
    const ptById = new Map(ptPurchases.map((item) => [item.id, item]));
    const rentalIds = payments.map((item) => item.facility_reservation_id).filter(Boolean);
    const rentals = rentalIds.length
      ? await prisma.facility_reservations.findMany({ where: { id: { in: rentalIds } } })
      : [];
    const rentalById = new Map(rentals.map((item) => [item.id, item]));
    const days = rentals.length
      ? await prisma.facility_days.findMany({ where: { id: { in: rentals.map((item) => item.day_id) } } })
      : [];
    const dayById = new Map(days.map((item) => [item.id, item]));
    const facilities = days.length
      ? await prisma.facilities.findMany({ where: { id: { in: days.map((item) => item.facility_id) } } })
      : [];
    const facilityById = new Map(facilities.map((item) => [item.id, item]));
    return payments.map((payment) => ({
      ...payment,
      member: memberById.get(payment.member_id) ?? null,
      membership: payment.membership_id ? (membershipById.get(payment.membership_id) ?? null) : null,
      ...(payment.facility_reservation_id && {
        service: {
          type: "facility",
          name:
            facilityById.get(dayById.get(rentalById.get(payment.facility_reservation_id)?.day_id)?.facility_id)?.name ??
            "Thuê sân/phòng",
          status: rentalById.get(payment.facility_reservation_id)?.status,
        },
      }),
      ...(payment.course_enrollment_id && {
        service: {
          type: "course",
          name: courseById.get(enrollmentById.get(payment.course_enrollment_id)?.course_id)?.name ?? "Khóa học",
          status: enrollmentById.get(payment.course_enrollment_id)?.status,
        },
      }),
      ...(payment.pt_purchase_id && {
        service: {
          type: "pt",
          name: ptById.get(payment.pt_purchase_id)?.package_name_snapshot ?? "Gói PT",
          status: ptById.get(payment.pt_purchase_id)?.status,
        },
      }),
    }));
  },
  saveCheckoutUrl: (id, url) => prisma.payments.update({ where: { id }, data: { provider_checkout_url: url } }),
  ptPurchase: (id) => prisma.pt_purchases.findUnique({ where: { id } }),
  facilityReservation: (id) => prisma.facility_reservations.findUnique({ where: { id } }),
  courseEnrollment: (id) => prisma.course_enrollments.findUnique({ where: { id } }),
  createWithEvent: (data, event, audit) =>
    prisma.$transaction(async (tx) => {
      const payment = await tx.payments.create({ data });
      await tx.payment_events.create({ data: { ...event, payment_id: payment.id, amount_vnd: payment.amount_vnd } });
      await recordPaymentAudit(tx, payment, audit, event.actor_user_id);
      return payment;
    }),
  paymentByCode: (transactionCode) => prisma.payments.findUnique({ where: { transaction_code: transactionCode } }),
  paymentByProviderOrderCode: (providerOrderCode) =>
    prisma.payments.findUnique({ where: { provider_order_code: BigInt(providerOrderCode) } }),
  complete: ({ id, status, paidAt, eventType, actorUserId, membershipId, note, audit }) =>
    prisma.$transaction(async (tx) => {
      const changed = await tx.payments.updateMany({
        where: { id, status: "pending" },
        data: { status, ...(paidAt && { paid_at: paidAt }) },
      });
      if (changed.count !== 1) return null;
      const payment = await tx.payments.findUnique({ where: { id } });
      await tx.payment_events.create({
        data: {
          payment_id: id,
          event_type: eventType,
          previous_status: "pending",
          new_status: status,
          amount_vnd: payment.amount_vnd,
          actor_user_id: actorUserId,
          ...(note && { note }),
        },
      });
      if (status === "paid" && membershipId) {
        await tx.member_memberships.update({
          where: { id: membershipId },
          data: { status: "active", activated_at: new Date(), activation_payment_id: id },
        });
        const member = await tx.members.findUnique({ where: { id: payment.member_id }, select: { user_id: true } });
        if (member?.user_id)
          await tx.notifications.create({
            data: {
              recipient_user_id: member.user_id,
              category: "finance",
              title: "Thanh toán thành công",
              body: "Gói tập của bạn đã được kích hoạt sau khi thanh toán thành công.",
              link_path: "/my/memberships",
            },
          });
      }
      if (status === "paid" && payment.course_enrollment_id) {
        try {
          await activateCourseEnrollment(tx, payment);
        } catch (error) {
          if (!["COURSE_UNAVAILABLE", "COURSE_PAYMENT_NOT_ELIGIBLE"].includes(error.code)) throw error;
          await tx.payments.update({ where: { id }, data: { fulfillment_error: error.code } });
          await tx.payment_events.create({
            data: {
              payment_id: id,
              event_type: "course_activation_requires_review",
              new_status: "paid",
              amount_vnd: payment.amount_vnd,
              actor_user_id: actorUserId,
              note: "Đã thu tiền nhưng đăng ký/lịch khóa không còn đủ điều kiện; cần đối soát, không tự cấp quyền hoặc hoàn tiền.",
            },
          });
          payment.fulfillment_error = error.code;
        }
      }
      if (status === "paid" && payment.pt_purchase_id) {
        try {
          await activatePtPurchase(tx, payment);
        } catch (error) {
          if (error.code !== "PT_PAYMENT_NOT_ELIGIBLE") throw error;
          await tx.payments.update({ where: { id }, data: { fulfillment_error: error.code } });
          await tx.payment_events.create({
            data: {
              payment_id: id,
              event_type: "pt_activation_requires_review",
              new_status: "paid",
              amount_vnd: payment.amount_vnd,
              actor_user_id: actorUserId,
              note: "Đã thu tiền nhưng gói PT cần đối soát quyền sử dụng.",
            },
          });
          payment.fulfillment_error = error.code;
        }
      }
      if (status === "paid" && payment.facility_reservation_id) {
        try {
          await activateFacilityReservation(tx, payment);
        } catch (error) {
          if (error.code !== "FACILITY_PAYMENT_NOT_ELIGIBLE") throw error;
          await tx.payments.update({ where: { id }, data: { fulfillment_error: error.code } });
          await tx.payment_events.create({
            data: {
              payment_id: id,
              event_type: "facility_activation_requires_review",
              new_status: "paid",
              amount_vnd: payment.amount_vnd,
              actor_user_id: actorUserId,
              note: "Đã nhận tiền nhưng đơn đặt sân cần đối soát quyền sử dụng hoặc hoàn tiền.",
            },
          });
          payment.fulfillment_error = error.code;
        }
      }
      await recordPaymentAudit(tx, payment, audit, actorUserId);
      return payment;
    }),
};
