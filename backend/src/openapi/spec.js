import { env } from "../config/env.js";

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Sports Center API",
    version: "0.1.0",
    description: "API contract for the Sports Center Management System MVP.",
  },
  servers: [{ url: env.apiBasePath }],
  paths: {
    "/members": { get: { tags: ["Members"], summary: "Danh sách hội viên", security: [{ sessionCookie: [] }], responses: { 200: { description: "Danh sách hội viên" } } }, post: { tags: ["Members"], summary: "Tạo hồ sơ hội viên", security: [{ sessionCookie: [] }], responses: { 201: { description: "Hồ sơ hội viên mới" } } } },
    "/members/{id}": { get: { tags: ["Members"], summary: "Chi tiết hội viên", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { 200: { description: "Hội viên" } } }, patch: { tags: ["Members"], summary: "Cập nhật hội viên", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã cập nhật" } } } },
    "/members/{id}/emergency-contacts": { put: { tags: ["Members"], summary: "Thay thế liên hệ khẩn cấp", security: [{ sessionCookie: [] }], responses: { 200: { description: "Danh sách liên hệ mới" } } } },
    "/staff": { get: { tags: ["Staff"], summary: "Danh sách nhân viên", security: [{ sessionCookie: [] }], responses: { 200: { description: "Danh sách nhân sự" }, 403: { description: "Thiếu quyền staff.manage" } } }, post: { tags: ["Staff"], summary: "Tạo nhân viên và trả mật khẩu tạm một lần", security: [{ sessionCookie: [] }], responses: { 201: { description: "Nhân viên mới và temporaryPassword" } } } },
    "/staff/{id}": { get: { tags: ["Staff"], summary: "Chi tiết nhân viên", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { 200: { description: "Nhân viên" } } }, patch: { tags: ["Staff"], summary: "Cập nhật nhân viên", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã cập nhật" } } } },
    "/staff/{id}/status": { patch: { tags: ["Staff"], summary: "Đình chỉ hoặc kích hoạt nhân viên", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã cập nhật trạng thái" } } } },
    "/auth/register": {
      post: { tags: ["Auth"], summary: "Đăng ký hội viên công khai", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } } }, responses: { 201: { description: "Đã tạo tài khoản chờ xác thực" }, 409: { description: "Email hoặc số điện thoại đã tồn tại" }, 422: { description: "Dữ liệu không hợp lệ" } } },
    },
    "/auth/verification/confirm": {
      post: { tags: ["Auth"], summary: "Xác thực email hoặc số điện thoại", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/VerificationRequest" } } } }, responses: { 200: { description: "Đã xác thực" }, 422: { description: "Mã không hợp lệ hoặc hết hạn" } } },
    },
    "/auth/verification/resend": { post: { tags: ["Auth"], summary: "Gửi lại mã xác thực", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/VerificationRecipient" } } } }, responses: { 200: { description: "Đã gửi mã" } } } },
    "/auth/login": { post: { tags: ["Auth"], summary: "Đăng nhập", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } }, responses: { 200: { description: "Đã tạo phiên; cookie HTTP-only được trả về" }, 401: { description: "Sai thông tin đăng nhập" }, 403: { description: "Tài khoản chưa hoạt động" } } } },
    "/auth/logout": { post: { tags: ["Auth"], summary: "Đăng xuất", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã đăng xuất" }, 401: { description: "Chưa đăng nhập" } } } },
    "/auth/me": { get: { tags: ["Auth"], summary: "Lấy người dùng và quyền của phiên hiện tại", security: [{ sessionCookie: [] }], responses: { 200: { description: "Phiên hợp lệ" }, 401: { description: "Phiên không hợp lệ" } } } },
    "/auth/registrations/pending": { get: { tags: ["Auth"], summary: "Danh sách đăng ký chờ Lễ tân duyệt", security: [{ sessionCookie: [] }], responses: { 200: { description: "Danh sách chờ duyệt" }, 403: { description: "Thiếu quyền registration.approve" } } } },
    "/auth/registrations/{userId}/approve": { post: { tags: ["Auth"], summary: "Lễ tân duyệt tài khoản hội viên", security: [{ sessionCookie: [] }], parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { 200: { description: "Tài khoản đã kích hoạt" }, 403: { description: "Thiếu quyền registration.approve" } } } },
    "/health": {
      get: {
        tags: ["System"],
        summary: "Check API availability",
        responses: {
          200: {
            description: "API is available",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "data"],
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      required: ["status"],
                      properties: { status: { type: "string", example: "ok" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: { sessionCookie: { type: "apiKey", in: "cookie", name: "sports_center_session" } },
    schemas: {
      RegisterRequest: { type: "object", required: ["fullName", "email", "phone", "password"], properties: { fullName: { type: "string", example: "Nguyễn Minh Anh" }, email: { type: "string", format: "email" }, phone: { type: "string", example: "0901234567" }, password: { type: "string", format: "password", minLength: 8 } } },
      VerificationRecipient: { type: "object", required: ["userId", "channel"], properties: { userId: { type: "string", format: "uuid" }, channel: { type: "string", enum: ["email", "phone"] } } },
      VerificationRequest: { allOf: [{ $ref: "#/components/schemas/VerificationRecipient" }, { type: "object", required: ["code"], properties: { code: { type: "string", example: "123456" } } }] },
      LoginRequest: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password" } } },
    },
  },
};
