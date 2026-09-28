import { prisma } from "../../database.js";

export const facilityRepository = {
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
      const item = await tx.facility_reservations.findUnique({ where: { id } });
      if (!item) return { kind: "missing" };
      if (item.status !== "pending") return { kind: "invalid" };
      const changed = await tx.facility_reservations.updateMany({ where: { id, status: "pending" }, data: { status: approved ? "approved" : "rejected", assigned_start_minute: approved ? startMinute : null, assigned_end_minute: approved ? endMinute : null, decision_reason: reason ?? null, reviewed_by: actorUserId, reviewed_at: new Date() } });
      if (changed.count !== 1) return { kind: "invalid" };
      const updated = await tx.facility_reservations.findUnique({ where: { id } });
      await tx.audit_logs.create({ data: { actor_user_id: actorUserId, action: approved ? "facility.reservation.approved" : "facility.reservation.rejected", entity_type: "facility_reservation", entity_id: id, summary: approved ? "Đã duyệt đơn đặt sân." : "Đã từ chối đơn đặt sân.", reason: reason ?? null } });
      return { kind: "updated", item: updated };
    });
  },
  async cancel({ id, reason, actorUserId }) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.facility_reservations.findUnique({ where: { id } });
      if (!item) return { kind: "missing" };
      if (!["pending", "approved"].includes(item.status)) return { kind: "invalid" };
      const changed = await tx.facility_reservations.updateMany({ where: { id, status: { in: ["pending", "approved"] } }, data: { status: "cancelled", cancelled_by: actorUserId, cancelled_at: new Date(), decision_reason: reason } });
      if (changed.count !== 1) return { kind: "invalid" };
      const updated = await tx.facility_reservations.findUnique({ where: { id } });
      await tx.audit_logs.create({ data: { actor_user_id: actorUserId, action: "facility.reservation.cancelled", entity_type: "facility_reservation", entity_id: id, summary: "Đã hủy đơn đặt sân.", reason } });
      return { kind: "updated", item: updated };
    });
  },
  async requestCancellation({ id, reason, actorUserId }) {
    return prisma.$transaction(async (tx) => {
      const changed = await tx.facility_reservations.updateMany({ where: { id, status: { in: ["pending", "approved"] }, cancellation_requested_at: null }, data: { cancellation_requested_by: actorUserId, cancellation_requested_at: new Date(), cancellation_reason: reason } });
      if (changed.count !== 1) return { kind: "invalid" };
      return { kind: "requested", item: await tx.facility_reservations.findUnique({ where: { id } }) };
    });
  },
  async confirmCancellation({ id, actorUserId }) {
    return prisma.$transaction(async (tx) => {
      const changed = await tx.facility_reservations.updateMany({ where: { id, requester_user_id: actorUserId, status: { in: ["pending", "approved"] }, cancellation_requested_at: { not: null } }, data: { status: "cancelled", cancelled_by: actorUserId, cancelled_at: new Date() } });
      if (changed.count !== 1) return { kind: "invalid" };
      return { kind: "updated", item: await tx.facility_reservations.findUnique({ where: { id } }) };
    });
  },
};
