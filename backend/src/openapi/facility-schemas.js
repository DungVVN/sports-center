import { uuid } from "./contract-helpers.js";

const facilityMinute = { type: "integer", minimum: 0, maximum: 1440 };
const facilityDay = { type: "string", format: "date" };
const facilitySuccess = (data, description = "Thành công") => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["success", "data"],
        properties: { success: { type: "boolean", const: true }, data },
      },
    },
  },
});
export const facilityResponse = (data) => ({ 200: facilitySuccess(data) });
const facilityTypeRecord = {
  type: "object",
  required: ["id", "name", "is_active", "created_at"],
  properties: {
    id: uuid,
    name: { type: "string" },
    is_active: { type: "boolean" },
    created_at: { type: "string", format: "date-time" },
  },
};
export const facilityRecord = {
  type: "object",
  required: ["id", "type_id", "name", "open_minute", "close_minute", "is_active", "created_at"],
  properties: {
    id: uuid,
    type_id: uuid,
    name: { type: "string" },
    open_minute: facilityMinute,
    close_minute: facilityMinute,
    is_active: { type: "boolean" },
    created_at: { type: "string", format: "date-time" },
  },
};
const facilityDayRecord = {
  type: "object",
  required: ["id", "facility_id", "open_on", "created_by", "created_at"],
  properties: {
    id: uuid,
    facility_id: uuid,
    open_on: {
      type: "string",
      format: "date-time",
      description: "Prisma DateTime @db.Date, serialized as UTC midnight",
    },
    created_by: uuid,
    created_at: { type: "string", format: "date-time" },
  },
};
export const facilityReservationRecord = {
  type: "object",
  required: [
    "id",
    "day_id",
    "requester_user_id",
    "requested_start_minute",
    "requested_end_minute",
    "participant_count",
    "contact_phone",
    "status",
    "requested_at",
  ],
  properties: {
    id: uuid,
    day_id: uuid,
    requester_user_id: uuid,
    requested_start_minute: facilityMinute,
    requested_end_minute: facilityMinute,
    assigned_start_minute: { type: ["integer", "null"], minimum: 0, maximum: 1440 },
    assigned_end_minute: { type: ["integer", "null"], minimum: 0, maximum: 1440 },
    participant_count: { type: "integer", minimum: 1 },
    contact_phone: { type: "string" },
    status: { type: "string", enum: ["pending", "approved", "rejected", "cancelled"] },
    requested_at: { type: "string", format: "date-time" },
    reviewed_by: { type: ["string", "null"], format: "uuid" },
    reviewed_at: { type: ["string", "null"], format: "date-time" },
    cancelled_by: { type: ["string", "null"], format: "uuid" },
    cancelled_at: { type: ["string", "null"], format: "date-time" },
    cancellation_requested_by: { type: ["string", "null"], format: "uuid" },
    cancellation_requested_at: { type: ["string", "null"], format: "date-time" },
    cancellation_reason: { type: ["string", "null"] },
    decision_reason: { type: ["string", "null"] },
  },
};
export const facilityReservation = {
  type: "object",
  required: [
    "id",
    "dayId",
    "date",
    "facilityName",
    "status",
    "requestedStartMinute",
    "requestedEndMinute",
    "participantCount",
    "phone",
  ],
  properties: {
    id: uuid,
    dayId: uuid,
    date: facilityDay,
    facilityName: { type: "string" },
    status: { type: "string", enum: ["pending", "approved", "rejected", "cancelled"] },
    requestedStartMinute: facilityMinute,
    requestedEndMinute: facilityMinute,
    assignedStartMinute: { ...facilityMinute, type: ["integer", "null"] },
    assignedEndMinute: { ...facilityMinute, type: ["integer", "null"] },
    participantCount: { type: "integer", minimum: 1 },
    phone: { type: "string" },
    requesterName: { type: "string", description: "Chỉ trả về khi có quyền facility.booking.read" },
    decisionReason: { type: ["string", "null"] },
    cancellationPending: { type: "boolean" },
    cancellationReason: { type: ["string", "null"] },
    cancellationRequestedAt: { type: ["string", "null"], format: "date-time" },
  },
};
export const facilityAuth = (permission, response, description) => ({
  tags: ["Facility calendar"],
  description: `${description} Yêu cầu quyền ${permission}.`,
  security: [{ sessionCookie: [] }],
  responses: {
    ...response,
    401: { description: "Chưa đăng nhập" },
    403: { description: "Thiếu quyền" },
    422: { description: "Dữ liệu hoặc trạng thái không hợp lệ" },
  },
});
export { facilityDay, facilityMinute, facilitySuccess, facilityTypeRecord, facilityDayRecord };
