import { uuid } from "./contract-helpers.js";

export const paymentsPaths = {
  "/payments": {
    get: {
      tags: ["Payments"],
      summary: "Danh sách phiếu thu",
      description: "Yêu cầu quyền payment.read. Manager chỉ xem; Admin và Lễ tân có thể thu tiền.",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Phiếu thu kèm hội viên và gói đã gắn" } },
    },
    post: {
      tags: ["Payments"],
      summary: "Admin hoặc Lễ tân lập phiếu thu hoặc link PayOS",
      description:
        "Yêu cầu quyền payment.record. Nếu gắn membership, amountVnd phải khớp giá snapshot; payment và event được ghi nguyên tử. Provider payos trả checkoutUrl/QR; chỉ webhook đã xác thực mới kích hoạt gói online.",
      security: [{ sessionCookie: [] }],
      responses: {
        201: { description: "Phiếu thu chờ xác nhận hoặc checkout URL" },
        422: { description: "Membership không đủ điều kiện hoặc số tiền không khớp giá gói" },
        503: { description: "PayOS hoặc HTTPS return origin chưa cấu hình" },
      },
    },
  },
  "/payments/targets": {
    get: {
      tags: ["Payments"],
      summary: "Dịch vụ chờ thanh toán của hội viên",
      description:
        "Yêu cầu payment.record. Trả giá đã chốt của gói tập, khóa học, PT và đơn thuê được duyệt; loại dịch vụ đã có phiếu pending/paid và đăng ký khóa hết hạn thanh toán.",
      security: [{ sessionCookie: [] }],
      "x-required-permission": "payment.record",
      parameters: [{ name: "memberId", in: "query", required: true, schema: uuid }],
      responses: {
        200: {
          description: "Danh sách dịch vụ",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["id", "targetField", "name", "amountVnd"],
                      properties: {
                        id: uuid,
                        targetField: {
                          type: "string",
                          enum: ["membershipId", "courseEnrollmentId", "ptPurchaseId", "facilityReservationId"],
                        },
                        name: { type: "string" },
                        amountVnd: { type: "string", pattern: "^[0-9]+$" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        403: { description: "Thiếu quyền lập phiếu thu" },
        404: { description: "Không tìm thấy hội viên" },
        422: { description: "memberId không hợp lệ" },
      },
    },
  },
  "/payments/callbacks/payos": {
    post: {
      tags: ["Payments"],
      summary: "Webhook PayOS",
      description:
        "Callback server-to-server, không dùng cookie. Backend kiểm tra chữ ký SDK PayOS, đối chiếu orderCode/amount với phiếu pending và xử lý idempotent trước khi kích hoạt membership.",
      responses: {
        200: { description: "Đã nhận callback" },
        401: { description: "Signature webhook không hợp lệ" },
        422: { description: "Callback không khớp giao dịch" },
      },
    },
  },
  "/members/me/payments": {
    get: {
      tags: ["Payments"],
      summary: "Hội viên xem giao dịch của mình",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Lịch sử giao dịch read-only" },
        404: { description: "Tài khoản chưa có hồ sơ hội viên" },
      },
    },
  },
  "/payments/{id}": {
    get: {
      tags: ["Payments"],
      summary: "Chi tiết giao dịch",
      description: "Yêu cầu quyền payment.read.",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Giao dịch" } },
    },
  },
  "/payments/{id}/confirm": {
    post: {
      tags: ["Payments"],
      summary: "Admin hoặc Lễ tân xác nhận tiền mặt/chuyển khoản",
      description:
        "Yêu cầu quyền payment.record. Không xác nhận thủ công thanh toán online. Chuyển khoản paid cần reconciliationNote tối thiểu 10 ký tự; audit lưu lý do đối soát.",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Đã xác nhận tiền mặt hoặc chuyển khoản; gói được kích hoạt và hội viên được thông báo" },
        422: { description: "Thiếu ghi chú đối soát hoặc thanh toán trực tuyến phải chờ webhook" },
      },
    },
  },
  "/members/me/payments/{id}": {
    get: {
      tags: ["Payments"],
      summary: "Hội viên xem biên lai của chính mình",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      responses: {
        200: { description: "Biên lai giao dịch thuộc hội viên" },
        403: { description: "Biên lai ngoài phạm vi tài khoản" },
        404: { description: "Không tìm thấy giao dịch" },
      },
    },
  },
};
