import { prisma } from "../../../database.js";
import { facilityFinanceRepository } from "./facility-finance.repository.js";
import { rentalTotal } from "../domain/rental-policy.js";
import { AppError } from "../../../shared/errors/app-error.js";

export const facilityRepository = {
  ...facilityFinanceRepository,
  types: () => prisma.facility_types.findMany({ where: { is_active: true }, orderBy: { name: "asc" } }),
  facilities: () => prisma.facilities.findMany({ where: { is_active: true }, orderBy: { name: "asc" } }),
  days: (from, to) => prisma.facility_days.findMany({ where: { open_on: { gte: from, lte: to } }, orderBy: [{ open_on: "asc" }, { facility_id: "asc" }] }),
  approved: (dayIds) => dayIds.length ? prisma.facility_reservations.findMany({ where: { day_id: { in: dayIds }, status: "approved" }, select: { day_id: true, assigned_start_minute: true, assigned_end_minute: true } }) : [],
  type: (id) => prisma.facility_types.findUnique({ where: { id } }),
  facility: (id) => prisma.facilities.findUnique({ where: { id } }),
  day: (id) => prisma.facility_days.findUnique({ where: { id } }),
  reservation: (id) => prisma.facility_reservations.findUnique({ where: { id } }),
  daysByIds: (ids) => prisma.facility_days.findMany({ where: { id: { in: ids } } }),
  facilitiesByIds: (ids) => prisma.facilities.findMany({ where: { id: { in: ids } } }),
  requester: (userId) => prisma.users.findUnique({ where: { id: userId }, select: { id: true, display_name: true, status: true } }),
  createType: (name) => prisma.facility_types.create({ data: { name } }),
  createFacility: (input) => prisma.facilities.create({ data: input }),
  createDay: (input) => prisma.facility_days.create({ data: input }),
  mine: async (userId) => {
    const [pending, cancellationRequests, recent] = await Promise.all([
      prisma.facility_reservations.findMany({ where: { requester_user_id: userId, status: "pending" }, orderBy: { requested_at: "desc" } }),
      prisma.facility_reservations.findMany({ where: { requester_user_id: userId, cancellation_requested_at: { not: null }, status: { in: ["pending", "approved"] } }, orderBy: { requested_at: "desc" } }),
      prisma.facility_reservations.findMany({ where: { requester_user_id: userId }, orderBy: { requested_at: "desc" }, take: 100 }),
    ]);
    return [...new Map([...pending, ...cancellationRequests, ...recent].map((item) => [item.id, item])).values()]
      .sort((left, right) => right.requested_at - left.requested_at);
  },
  reservations: async () => {
    const [pending, cancellationRequests, recent] = await Promise.all([
      prisma.facility_reservations.findMany({ where: { status: "pending" }, orderBy: { requested_at: "desc" } }),
      prisma.facility_reservations.findMany({ where: { cancellation_requested_at: { not: null }, status: { in: ["pending", "approved"] } }, orderBy: { requested_at: "desc" } }),
      prisma.facility_reservations.findMany({ orderBy: { requested_at: "desc" }, take: 200 }),
    ]);
    return [...new Map([...pending, ...cancellationRequests, ...recent].map((item) => [item.id, item])).values()]
      .sort((left, right) => right.requested_at - left.requested_at);
  },
  requesters: (ids) => prisma.users.findMany({ where: { id: { in: ids } }, select: { id: true, display_name: true } }),
  async request({ dayId, requesterUserId, startMinute, endMinute, participantCount, phone, actorUserId }) {
    return prisma.$transaction(async (tx) => {
      const occupied = await tx.facility_reservations.findFirst({ where: { day_id: dayId, status: "approved", assigned_start_minute: { lt: endMinute }, assigned_end_minute: { gt: startMinute } } });
      if (occupied) return { kind: "occupied" };
      const duplicate = await tx.facility_reservations.findFirst({ where: { day_id: dayId, requester_user_id: requesterUserId, status: "pending", requested_start_minute: startMinute, requested_end_minute: endMinute } });
      if (duplicate) return { kind: "duplicate" };
      const item = await tx.facility_reservations.create({ data: { day_id: dayId, requester_user_id: requesterUserId, requested_start_minute: startMinute, requested_end_minute: endMinute, participant_count: participantCount, contact_phone: phone } });
      await tx.audit_logs.create({ data: { actor_user_id: actorUserId, action: "facility.reservation.requested", entity_type: "facility_reservation", entity_id: item.id, summary: "Hội viên gửi yêu cầu đặt sân." } });
      return { kind: "created", item };
    });
  },
  async review({ id, approved, startMinute, endMinute, reason, actorUserId }) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM facility_reservations WHERE id=${id}::uuid FOR UPDATE`;
      const item = await tx.facility_reservations.findUnique({ where: { id } });
      if (!item) return { kind: "missing" };
      if (item.status !== "pending") return { kind: "invalid" };
      let quote = {};
      if (approved) {
        const day = await tx.facility_days.findUnique({ where: { id: item.day_id } });
        const facility = await tx.facilities.findUnique({ where: { id: day.facility_id } });
        if (facility.hourly_rate_vnd === null) throw new AppError({ statusCode: 422, code: "FACILITY_RATE_REQUIRED", message: "Cần cấu hình đơn giá theo giờ trước khi duyệt đơn mới." });
        const total = rentalTotal(facility.hourly_rate_vnd, startMinute, endMinute);
        quote = { hourly_rate_vnd_snapshot: facility.hourly_rate_vnd, total_vnd_snapshot: total, payment_state: total === 0n ? "free" : "unpaid" };
      }
      const changed = await tx.facility_reservations.updateMany({ where: { id, status: "pending" }, data: { ...quote, status: approved ? "approved" : "rejected", assigned_start_minute: approved ? startMinute : null, assigned_end_minute: approved ? endMinute : null, decision_reason: reason ?? null, reviewed_by: actorUserId, reviewed_at: new Date() } });
      if (changed.count !== 1) return { kind: "invalid" };
      const updated = await tx.facility_reservations.findUnique({ where: { id } });
      await tx.audit_logs.create({ data: { actor_user_id: actorUserId, action: approved ? "facility.reservation.approved" : "facility.reservation.rejected", entity_type: "facility_reservation", entity_id: id, summary: approved ? "Đã duyệt đơn đặt sân." : "Đã từ chối đơn đặt sân.", reason: reason ?? null } });
      await tx.notifications.create({ data: { recipient_user_id: item.requester_user_id, category: "operations", title: approved ? "Đơn đặt sân đã được duyệt" : "Đơn đặt sân bị từ chối", body: approved ? "Xem khung giờ và giá đã chốt để thanh toán đơn đặt sân." : reason ?? "Trung tâm đã từ chối yêu cầu.", link_path: "/facilities" } });
      return { kind: "updated", item: updated };
    });
  },
  async cancel({ id, reason, actorUserId }) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.facility_reservations.findUnique({ where: { id } });
      if (!item) return { kind: "missing" };
      if (item.completed_at || !["pending", "approved"].includes(item.status)) return { kind: "invalid" };
      const changed = await tx.facility_reservations.updateMany({ where: { id, status: { in: ["pending", "approved"] }, completed_at: null }, data: { status: "cancelled", cancelled_by: actorUserId, cancelled_at: new Date(), decision_reason: reason } });
      if (changed.count !== 1) return { kind: "invalid" };
      const updated = await tx.facility_reservations.findUnique({ where: { id } });
      await tx.audit_logs.create({ data: { actor_user_id: actorUserId, action: "facility.reservation.cancelled", entity_type: "facility_reservation", entity_id: id, summary: "Đã hủy đơn đặt sân.", reason } });
      return { kind: "updated", item: updated };
    });
  },
  async requestCancellation({ id, reason, actorUserId }) {
    return prisma.$transaction(async (tx) => {
      const changed = await tx.facility_reservations.updateMany({ where: { id, status: { in: ["pending", "approved"] }, cancellation_requested_at: null, completed_at: null }, data: { cancellation_requested_by: actorUserId, cancellation_requested_at: new Date(), cancellation_reason: reason } });
      if (changed.count !== 1) return { kind: "invalid" };
      await tx.audit_logs.create({ data: { actor_user_id: actorUserId, action: "facility.reservation.cancellation_requested", entity_type: "facility_reservation", entity_id: id, summary: "Đã gửi yêu cầu hủy đơn cho người tạo đơn xác nhận.", reason } });
      return { kind: "requested", item: await tx.facility_reservations.findUnique({ where: { id } }) };
    });
  },
  async confirmCancellation({ id, actorUserId }) {
    return prisma.$transaction(async (tx) => {
      const changed = await tx.facility_reservations.updateMany({ where: { id, requester_user_id: actorUserId, status: { in: ["pending", "approved"] }, cancellation_requested_at: { not: null }, completed_at: null }, data: { status: "cancelled", cancelled_by: actorUserId, cancelled_at: new Date() } });
      if (changed.count !== 1) return { kind: "invalid" };
      const item = await tx.facility_reservations.findUnique({ where: { id } });
      await tx.audit_logs.create({ data: { actor_user_id: actorUserId, action: "facility.reservation.cancellation_confirmed", entity_type: "facility_reservation", entity_id: id, summary: "Người tạo đơn đã xác nhận hủy đơn đặt sân.", reason: item.cancellation_reason } });
      return { kind: "updated", item };
    });
  },
};
