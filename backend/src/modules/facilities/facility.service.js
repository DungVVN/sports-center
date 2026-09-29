import { AppError } from "../../shared/errors/app-error.js";

const fail = (statusCode, code, message) => { throw new AppError({ statusCode, code, message }); };
const dayString = (value) => value.toISOString().slice(0, 10);
const todayInVietnam = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const currentMinuteInVietnam = () => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === "hour").value) * 60 + Number(parts.find((part) => part.type === "minute").value);
};
const duplicate = (error) => error.code === "P2002";
const overlap = (error) => error.code === "P2004" || error.code === "23P01" || error.message?.includes("facility_approved_no_overlap");

export function createFacilityService({ repository, auditService }) {
  async function decorated(items, includeRequester) {
    const days = await repository.daysByIds([...new Set(items.map((item) => item.day_id))]);
    const facilities = await repository.facilitiesByIds([...new Set(days.map((day) => day.facility_id))]);
    const requesters = includeRequester ? await repository.requesters([...new Set(items.map((item) => item.requester_user_id))]) : [];
    const dayById = new Map(days.map((day) => [day.id, day]));
    const facilityById = new Map(facilities.map((facility) => [facility.id, facility]));
    const requesterById = new Map(requesters.map((requester) => [requester.id, requester]));
    return items.map((item) => {
      const day = dayById.get(item.day_id);
      const facility = facilityById.get(day?.facility_id);
      return { id: item.id, dayId: item.day_id, date: day ? dayString(day.open_on) : null, facilityName: facility?.name ?? "Sân không còn hoạt động", status: item.status, requestedStartMinute: item.requested_start_minute, requestedEndMinute: item.requested_end_minute, assignedStartMinute: item.assigned_start_minute, assignedEndMinute: item.assigned_end_minute, participantCount: item.participant_count, phone: item.contact_phone, requestedAt: item.requested_at, decisionReason: item.decision_reason, cancellationPending: ["pending", "approved"].includes(item.status) && Boolean(item.cancellation_requested_at), cancellationReason: item.cancellation_reason ?? null, cancellationRequestedAt: item.cancellation_requested_at ?? null, ...(includeRequester && { requesterName: requesterById.get(item.requester_user_id)?.display_name ?? "Người đặt" }) };
    });
  }
  return {
    async publicCalendar({ from, to, typeId }) {
      const [types, allFacilities, allDays] = await Promise.all([repository.types(), repository.facilities(), repository.days(new Date(from), new Date(to))]);
      const activeTypeIds = new Set(types.map((type) => type.id));
      const facilities = allFacilities.filter((facility) => activeTypeIds.has(facility.type_id) && (!typeId || facility.type_id === typeId));
      const facilityIds = new Set(facilities.map((facility) => facility.id));
      const days = allDays.filter((day) => facilityIds.has(day.facility_id));
      const approved = await repository.approved(days.map((day) => day.id));
      const bookedByDay = new Map();
      for (const item of approved) bookedByDay.set(item.day_id, [...(bookedByDay.get(item.day_id) ?? []), { startMinute: item.assigned_start_minute, endMinute: item.assigned_end_minute }]);
      const facilityById = new Map(facilities.map((facility) => [facility.id, facility]));
      const today = todayInVietnam();
      const nowMinute = currentMinuteInVietnam();
      return { types: types.map(({ id, name }) => ({ id, name })), facilities: facilities.map(({ id, type_id, name, open_minute, close_minute }) => ({ id, typeId: type_id, name, openMinute: open_minute, closeMinute: close_minute })), days: days.map((day) => {
        const facility = facilityById.get(day.facility_id);
        const booked = (bookedByDay.get(day.id) ?? []).sort((a, b) => a.startMinute - b.startMinute);
        const date = dayString(day.open_on);
        const free = []; let cursor = date < today ? facility.close_minute : date === today ? Math.max(facility.open_minute, nowMinute) : facility.open_minute;
        for (const period of booked) { if (cursor < period.startMinute) free.push({ startMinute: cursor, endMinute: period.startMinute }); cursor = Math.max(cursor, period.endMinute); }
        if (cursor < facility.close_minute) free.push({ startMinute: cursor, endMinute: facility.close_minute });
        return { id: day.id, facilityId: day.facility_id, date, free, booked };
      }) };
    },
    async createType(name, actorUserId) {
      try { const item = await repository.createType(name); await auditService.record({ actorUserId, action: "facility.type.created", entityType: "facility_type", entityId: item.id, summary: "Đã thêm loại sân." }); return item; }
      catch (error) { if (duplicate(error)) fail(409, "FACILITY_TYPE_EXISTS", "Loại sân đã tồn tại."); throw error; }
    },
    async createFacility(input, actorUserId) {
      const type = await repository.type(input.typeId);
      if (!type?.is_active) fail(422, "FACILITY_TYPE_UNAVAILABLE", "Loại sân không khả dụng.");
      try { const item = await repository.createFacility({ type_id: input.typeId, name: input.name, open_minute: input.openMinute, close_minute: input.closeMinute }); await auditService.record({ actorUserId, action: "facility.created", entityType: "facility", entityId: item.id, summary: "Đã thêm sân." }); return item; }
      catch (error) { if (duplicate(error)) fail(409, "FACILITY_EXISTS", "Sân đã tồn tại trong loại này."); throw error; }
    },
    async createDay(input, actorUserId) {
      const facility = await repository.facility(input.facilityId);
      if (!facility?.is_active) fail(422, "FACILITY_UNAVAILABLE", "Sân không khả dụng.");
      const type = await repository.type(facility.type_id);
      if (!type?.is_active) fail(422, "FACILITY_TYPE_UNAVAILABLE", "Loại sân không khả dụng.");
      if (input.date < todayInVietnam()) fail(422, "FACILITY_DAY_PAST", "Không thể mở ngày trong quá khứ.");
      try { const item = await repository.createDay({ facility_id: input.facilityId, open_on: new Date(input.date), created_by: actorUserId }); await auditService.record({ actorUserId, action: "facility.day.created", entityType: "facility_day", entityId: item.id, summary: "Đã mở ngày đặt sân." }); return item; }
      catch (error) { if (duplicate(error)) fail(409, "FACILITY_DAY_EXISTS", "Ngày này đã được mở cho sân."); throw error; }
    },
    async request(input, actorUserId) {
      const requester = await repository.requester(actorUserId);
      if (!requester || requester.status !== "active") fail(403, "FACILITY_REQUESTER_UNAVAILABLE", "Tài khoản không thể gửi yêu cầu đặt sân.");
      const day = await repository.day(input.dayId);
      const facility = day ? await repository.facility(day.facility_id) : null;
      if (!day || !facility?.is_active) fail(422, "FACILITY_DAY_UNAVAILABLE", "Ngày đặt sân không khả dụng.");
      const type = await repository.type(facility.type_id);
      if (!type?.is_active) fail(422, "FACILITY_TYPE_UNAVAILABLE", "Loại sân không khả dụng.");
      const date = dayString(day.open_on);
      if (date < todayInVietnam() || (date === todayInVietnam() && input.startMinute <= currentMinuteInVietnam())) fail(422, "FACILITY_TIME_PAST", "Giờ đặt sân phải ở tương lai.");
      if (input.startMinute < facility.open_minute || input.endMinute > facility.close_minute) fail(422, "FACILITY_CLOSED", "Giờ yêu cầu ngoài giờ hoạt động của sân.");
      let result;
      try { result = await repository.request({ dayId: input.dayId, requesterUserId: actorUserId, startMinute: input.startMinute, endMinute: input.endMinute, participantCount: input.participantCount, phone: input.phone, actorUserId }); }
      catch (error) { if (duplicate(error)) fail(409, "FACILITY_REQUEST_DUPLICATE", "Bạn đã gửi yêu cầu cho khoảng giờ này."); throw error; }
      if (result.kind !== "created") fail(409, result.kind === "occupied" ? "FACILITY_TIME_BOOKED" : "FACILITY_REQUEST_DUPLICATE", result.kind === "occupied" ? "Khoảng giờ này đã được đặt." : "Bạn đã gửi yêu cầu cho khoảng giờ này.");
      return result.item;
    },
    async mine(actorUserId) { return decorated(await repository.mine(actorUserId), false); },
    async reservations() { return decorated(await repository.reservations(), true); },
    async review(id, input, actorUserId) {
      const current = await repository.reservation(id);
      if (!current) fail(404, "FACILITY_REQUEST_NOT_FOUND", "Không tìm thấy đơn đặt sân.");
      const day = await repository.day(current.day_id);
      const facility = await repository.facility(day.facility_id);
      const startMinute = input.startMinute ?? current.requested_start_minute;
      const endMinute = input.endMinute ?? current.requested_end_minute;
      const date = dayString(day.open_on);
      if (input.approved && (endMinute <= startMinute || startMinute < facility.open_minute || endMinute > facility.close_minute || date < todayInVietnam() || (date === todayInVietnam() && startMinute <= currentMinuteInVietnam()))) fail(422, "FACILITY_TIME_INVALID", "Giờ duyệt ngoài ngày hoặc giờ hoạt động của sân.");
      try { const result = await repository.review({ id, approved: input.approved, startMinute, endMinute, reason: input.reason, actorUserId }); if (result.kind === "missing") fail(404, "FACILITY_REQUEST_NOT_FOUND", "Không tìm thấy đơn đặt sân."); if (result.kind === "invalid") fail(409, "FACILITY_REQUEST_FINAL", "Đơn không còn chờ duyệt."); return result.item; }
      catch (error) { if (overlap(error)) fail(409, "FACILITY_TIME_BOOKED", "Khoảng giờ đã có đơn được duyệt."); throw error; }
    },
    async cancel(id, reason, actorUserId) {
      const current = await repository.reservation(id);
      if (!current) fail(404, "FACILITY_REQUEST_NOT_FOUND", "Không tìm thấy đơn đặt sân.");
      const ownReservation = current.requester_user_id === actorUserId;
      const result = ownReservation ? await repository.cancel({ id, reason, actorUserId }) : await repository.requestCancellation({ id, reason, actorUserId });
      if (result.kind === "missing") fail(404, "FACILITY_REQUEST_NOT_FOUND", "Không tìm thấy đơn đặt sân.");
      if (result.kind === "invalid") fail(409, "FACILITY_CANCELLATION_NOT_AVAILABLE", "Đơn không thể hủy hoặc đang chờ người tạo đơn xác nhận.");
      await auditService.record({ actorUserId, action: ownReservation ? "facility.reservation.cancelled" : "facility.reservation.cancellation_requested", entityType: "facility_reservation", entityId: id, summary: ownReservation ? "Người tạo đơn đã hủy đơn đặt sân." : "Đã gửi yêu cầu hủy đơn cho người tạo đơn xác nhận.", reason });
      return { ...result.item, cancellationPending: result.kind === "requested" };
    },
    async confirmCancellation(id, actorUserId) {
      const current = await repository.reservation(id);
      if (!current) fail(404, "FACILITY_REQUEST_NOT_FOUND", "Không tìm thấy đơn đặt sân.");
      if (current.requester_user_id !== actorUserId) fail(403, "FACILITY_CANCELLATION_CONFIRMATION_DENIED", "Chỉ người tạo đơn mới có thể xác nhận hủy.");
      const result = await repository.confirmCancellation({ id, actorUserId });
      if (result.kind === "invalid") fail(409, "FACILITY_CANCELLATION_NOT_AVAILABLE", "Đơn không có yêu cầu hủy đang chờ xác nhận.");
      await auditService.record({ actorUserId, action: "facility.reservation.cancellation_confirmed", entityType: "facility_reservation", entityId: id, summary: "Người tạo đơn đã xác nhận hủy đơn đặt sân.", reason: current.cancellation_reason });
      return result.item;
    },
  };
}
