import { uuid, jsonBody } from "./contract-helpers.js";

export const trainingPaths = {
  "/training-templates": {
    get: {
      tags: ["Training"],
      summary: "Mẫu giáo án",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Mẫu" } },
    },
    post: {
      tags: ["Training"],
      summary: "Tạo mẫu giáo án",
      description: "Yêu cầu quyền training.template.manage.",
      security: [{ sessionCookie: [] }],
      responses: { 201: { description: "Mẫu mới" }, 403: { description: "Thiếu quyền quản lý mẫu giáo án" } },
    },
  },
  "/members/me/training": {
    get: {
      tags: ["Training"],
      summary: "Hội viên xem giáo án và kết quả của mình",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Giáo án và kết quả read-only của hội viên" },
        404: { description: "Tài khoản chưa có hồ sơ hội viên" },
      },
    },
  },
  "/training-members": {
    get: {
      tags: ["Training"],
      summary: "Hội viên đủ scope để lập giáo án",
      description:
        "Coach chỉ nhận hội viên trong phạm vi được phân công/lớp phụ trách; Admin và Manager nhận danh sách vận hành đầy đủ.",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Hội viên có thể chọn" }, 403: { description: "Thiếu quyền training.write" } },
    },
  },
  "/training-plans": {
    get: {
      tags: ["Training"],
      summary: "Danh sách giáo án",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Giáo án" } },
    },
    post: {
      tags: ["Training"],
      summary: "Tạo giáo án cá nhân",
      security: [{ sessionCookie: [] }],
      responses: { 201: { description: "Giáo án mới" } },
    },
  },
  "/training-plans/{id}": {
    patch: {
      tags: ["Training"],
      summary: "Cập nhật giáo án",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Đã cập nhật" } },
    },
  },
  "/training-results": {
    post: {
      tags: ["Training"],
      summary: "Ghi nhận kết quả tập",
      security: [{ sessionCookie: [] }],
      responses: { 201: { description: "Kết quả mới" } },
    },
  },
  "/training-plans/{id}/sessions": {
    get: {
      tags: ["Training"],
      summary: "Danh sách buổi tập của giáo án",
      description: "Yêu cầu quyền training.write và áp dụng scope Coach nếu là Coach.",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      responses: { 200: { description: "Các buổi tập và bài tập" }, 403: { description: "Ngoài phạm vi Coach" } },
    },
    post: {
      tags: ["Training"],
      summary: "Tạo buổi tập cho giáo án",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      requestBody: jsonBody({ $ref: "#/components/schemas/TrainingSessionRequest" }),
      responses: {
        201: { description: "Buổi tập mới" },
        403: { description: "Thiếu quyền training.write hoặc ngoài phạm vi Coach" },
      },
    },
  },
  "/training-plans/{id}/sessions/order": {
    put: {
      tags: ["Training"],
      summary: "Sắp thứ tự các buổi tập",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      requestBody: jsonBody({ $ref: "#/components/schemas/UuidOrderRequest" }),
      responses: {
        200: { description: "Đã sắp thứ tự" },
        403: { description: "Thiếu quyền training.write hoặc ngoài phạm vi Coach" },
      },
    },
  },
  "/training-sessions/{id}/exercises/order": {
    put: {
      tags: ["Training"],
      summary: "Sắp thứ tự bài tập trong buổi",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      requestBody: jsonBody({ $ref: "#/components/schemas/UuidOrderRequest" }),
      responses: {
        200: { description: "Đã sắp thứ tự" },
        403: { description: "Thiếu quyền training.write hoặc ngoài phạm vi Coach" },
      },
    },
  },
  "/training-sessions/{id}": {
    patch: {
      tags: ["Training"],
      summary: "Cập nhật trạng thái buổi tập",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      requestBody: jsonBody({
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["pending", "completed", "skipped"] },
          coachComment: { type: "string", maxLength: 500 },
        },
      }),
      responses: {
        200: { description: "Buổi tập đã cập nhật" },
        403: { description: "Thiếu quyền training.write hoặc ngoài phạm vi Coach" },
      },
    },
  },
  "/members/{id}/training-results": {
    get: {
      tags: ["Training"],
      summary: "Kết quả tập của hội viên",
      description: "Yêu cầu quyền training.write; Coach chỉ xem hội viên trong phạm vi.",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      responses: { 200: { description: "Kết quả tập" }, 403: { description: "Ngoài phạm vi Coach" } },
    },
  },
};
