import { uuid, jsonBody } from "./contract-helpers.js";
import { facilityAuth, facilityResponse, facilityRecord, facilityReservation, facilityReservationRecord, facilityDay, facilityMinute, facilitySuccess, facilityTypeRecord, facilityDayRecord } from "./facility-schemas.js";

export function applyFacilityContract(openApiSpec) {
  Object.assign(openApiSpec.paths, {
    "/public/courses": {
      get: {
        tags: ["Courses"],
        summary: "Khóa đã công bố và chưa bắt đầu",
        security: [],
        responses: {
          200: { description: "Giá, số chỗ còn lại và lịch khóa; không trả thông tin học viên/nhân viên nội bộ" },
        },
      },
    },
    "/public/pt-packages": {
      get: {
        tags: ["PT"],
        summary: "Gói PT đang bán",
        security: [],
        responses: { 200: { description: "Giá, số buổi, thời lượng, hạn dùng và điều kiện hủy" } },
      },
    },
    "/public/facility-calendar": {
      get: {
        tags: ["Facility calendar"],
        summary: "Lịch sân công khai không có dữ liệu người đặt",
        security: [],
        parameters: [
          { name: "from", in: "query", required: true, schema: facilityDay },
          { name: "to", in: "query", required: true, schema: facilityDay },
          { name: "typeId", in: "query", schema: uuid },
        ],
        responses: {
          ...facilityResponse({
            type: "object",
            required: ["types", "facilities", "days"],
            properties: {
              types: {
                type: "array",
                items: { type: "object", required: ["id", "name"], properties: { id: uuid, name: { type: "string" } } },
              },
              facilities: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "typeId", "name", "openMinute", "closeMinute"],
                  properties: {
                    id: uuid,
                    typeId: uuid,
                    name: { type: "string" },
                    openMinute: facilityMinute,
                    closeMinute: facilityMinute,
                  },
                },
              },
              days: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "facilityId", "date", "free", "booked"],
                  properties: {
                    id: uuid,
                    facilityId: uuid,
                    date: facilityDay,
                    free: {
                      type: "array",
                      items: { type: "object", properties: { startMinute: facilityMinute, endMinute: facilityMinute } },
                    },
                    booked: {
                      type: "array",
                      items: { type: "object", properties: { startMinute: facilityMinute, endMinute: facilityMinute } },
                    },
                  },
                },
              },
            },
          }),
          422: { description: "Ngày không hợp lệ hoặc khoảng xem quá 31 ngày" },
        },
      },
    },
    "/facility-types": {
      post: {
        ...facilityAuth(
          "facility.manage",
          { 201: facilitySuccess(facilityTypeRecord, "Loại sân mới"), 409: { description: "Trùng tên loại sân" } },
          "Người được cấp quyền thêm loại sân động.",
        ),
        requestBody: jsonBody({
          type: "object",
          required: ["name"],
          properties: { name: { type: "string", minLength: 2, maxLength: 80 } },
        }),
      },
    },
    "/facilities": {
      post: {
        ...facilityAuth(
          "facility.manage",
          { 201: facilitySuccess(facilityRecord, "Sân mới"), 409: { description: "Trùng sân" } },
          "Người được cấp quyền thêm sân và cấu hình giờ hoạt động theo phút trong ngày.",
        ),
        requestBody: jsonBody({
          type: "object",
          required: ["typeId", "name", "openMinute", "closeMinute"],
          properties: {
            typeId: uuid,
            name: { type: "string", minLength: 2, maxLength: 100 },
            openMinute: facilityMinute,
            closeMinute: facilityMinute,
          },
        }),
      },
    },
    "/facility-days": {
      post: {
        ...facilityAuth(
          "facility.day.manage",
          { 201: facilitySuccess(facilityDayRecord, "Ngày được mở cho sân"), 409: { description: "Ngày đã mở" } },
          "Chỉ mở ngày; không tạo sẵn khung giờ.",
        ),
        requestBody: jsonBody({
          type: "object",
          required: ["facilityId", "date"],
          properties: { facilityId: uuid, date: facilityDay },
        }),
      },
    },
    "/facility-reservations/me": {
      get: facilityAuth(
        "facility.booking.self.read",
        facilityResponse({ type: "array", items: facilityReservation }),
        "Người dùng chỉ xem đơn của chính mình.",
      ),
    },
    "/facility-reservations": {
      get: facilityAuth(
        "facility.booking.read",
        facilityResponse({ type: "array", items: facilityReservation }),
        "Chỉ nhân viên có quyền được xem toàn bộ danh sách đơn đặt sân; Hội viên dùng /facility-reservations/me.",
      ),
      post: {
        ...facilityAuth(
          "facility.booking.request",
          {
            201: facilitySuccess(facilityReservationRecord, "Đơn chờ duyệt"),
            409: { description: "Giờ đã được đặt hoặc yêu cầu trùng" },
          },
          "Người có quyền gửi yêu cầu; tên lấy từ tài khoản, không nhận từ client.",
        ),
        requestBody: jsonBody({
          type: "object",
          required: ["dayId", "startMinute", "endMinute", "participantCount", "phone"],
          properties: {
            dayId: uuid,
            startMinute: facilityMinute,
            endMinute: facilityMinute,
            participantCount: { type: "integer", minimum: 1, maximum: 100 },
            phone: { type: "string", pattern: "^(?:\\+84|0)\\d{9,10}$" },
          },
        }),
      },
    },
    "/facility-reservations/{id}/review": {
      patch: {
        ...facilityAuth(
          "facility.booking.approve",
          {
            200: facilitySuccess(facilityReservationRecord, "Đã duyệt hoặc từ chối"),
            404: { description: "Không tìm thấy đơn" },
            409: { description: "Đơn hết trạng thái chờ hoặc trùng giờ đã duyệt" },
          },
          "Người có quyền chốt/điều chỉnh giờ trong giờ mở cửa; từ chối cần lý do.",
        ),
        requestBody: jsonBody({
          type: "object",
          required: ["approved"],
          properties: {
            approved: { type: "boolean" },
            startMinute: facilityMinute,
            endMinute: facilityMinute,
            reason: { type: "string", minLength: 3, maxLength: 500 },
          },
        }),
      },
    },
    "/facility-reservations/{id}/cancel": {
      patch: {
        ...facilityAuth(
          "facility.booking.cancel",
          {
            200: facilitySuccess(facilityReservationRecord, "Đã hủy hoặc tạo yêu cầu hủy"),
            404: { description: "Không tìm thấy đơn" },
            409: { description: "Đơn không thể hủy" },
          },
          "Hội viên chỉ hủy đơn của mình và cần quyền xem đơn bản thân; nhân viên có quyền tạo yêu cầu hủy để người tạo đơn xác nhận.",
        ),
        requestBody: jsonBody({
          type: "object",
          required: ["reason"],
          properties: { reason: { type: "string", minLength: 3, maxLength: 500 } },
        }),
      },
    },
    "/facility-reservations/{id}/cancel/confirm": {
      patch: {
        tags: ["Facility calendar"],
        description: "Chỉ người tạo đơn có thể xác nhận yêu cầu hủy đang chờ.",
        security: [{ sessionCookie: [] }],
        responses: {
          200: facilitySuccess(facilityReservationRecord, "Đã xác nhận hủy"),
          401: { description: "Chưa đăng nhập" },
          403: { description: "Không phải người tạo đơn" },
          404: { description: "Không tìm thấy đơn" },
          409: { description: "Không có yêu cầu hủy đang chờ" },
        },
      },
    },
  });

}
