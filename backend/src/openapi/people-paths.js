import { uuid } from "./contract-helpers.js";

export const peoplePaths = {
  "/members/me": {
    get: {
      tags: ["Members"],
      summary: "Hội viên xem hồ sơ của chính mình",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Hồ sơ cá nhân" } },
    },
  },
  "/members/{id}/coach-assignments": {
    get: {
      tags: ["Coach assignments"],
      summary: "Lịch sử coach của hội viên",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: {
        200: { description: "Lịch sử" },
        403: { description: "Thiếu quyền member.write" },
        404: { description: "Không tìm thấy hội viên" },
      },
    },
    post: {
      tags: ["Coach assignments"],
      summary: "Đổi coach chính và giữ lịch sử hiệu lực",
      description:
        "Coach cũ kết thúc vào ngày trước effectiveFrom, nên không có ngày chồng quyền. Chỉ Coach đang active mới được chọn và ngày hiệu lực không nằm trong quá khứ.",
      security: [{ sessionCookie: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["coachUserId", "effectiveFrom"],
              properties: {
                coachUserId: { type: "string", format: "uuid" },
                effectiveFrom: { type: "string", format: "date" },
                reason: { type: "string", maxLength: 500 },
              },
            },
          },
        },
      },
      responses: {
        201: { description: "Đã phân công" },
        404: { description: "Không tìm thấy hội viên" },
        422: { description: "Coach không khả dụng hoặc ngày hiệu lực không hợp lệ" },
      },
    },
  },
  "/members": {
    get: {
      tags: ["Members"],
      summary: "Danh sách hội viên",
      description:
        "Danh sách quản lý gồm Coach hiện tại, gói đăng ký, tình trạng gói và ngày hết hạn; tất cả đều lấy từ dữ liệu phân công và membership hiện hành trong database.",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Danh sách hội viên" } },
    },
    post: {
      tags: ["Members"],
      summary: "Tạo hội viên và tùy chọn tài khoản đăng nhập",
      description:
        "Đặt createAccount=true để tạo tài khoản role member, bắt buộc email và gửi mật khẩu tạm qua email. temporaryPassword chỉ trả về khi gửi email thất bại.",
      security: [{ sessionCookie: [] }],
      responses: {
        201: {
          description:
            "Hồ sơ hội viên mới; credentialEmailDelivered cho biết email đã gửi, temporaryPassword chỉ xuất hiện khi gửi thất bại",
        },
      },
    },
  },
  "/members/{id}": {
    get: {
      tags: ["Members"],
      summary: "Chi tiết hội viên",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { 200: { description: "Hội viên" } },
    },
    patch: {
      tags: ["Members"],
      summary: "Cập nhật hội viên",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Đã cập nhật" } },
    },
  },
  "/members/{id}/account-credentials": {
    post: {
      tags: ["Members"],
      summary: "Tạo hoặc cấp lại mật khẩu tạm cho hội viên",
      description:
        "Yêu cầu quyền member.credentials.reset; role hội viên không được dùng endpoint này. Admin luôn có quyền. Nếu đã có tài khoản, mật khẩu tạm mới sẽ thu hồi mọi phiên cũ và buộc đổi ở lần đăng nhập tiếp theo. Email được gửi qua nhà cung cấp đã cấu hình; temporaryPassword chỉ trả về khi gửi thất bại.",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: {
        200: { description: "Tài khoản hoặc mật khẩu tạm đã được cấp lại" },
        403: { description: "Thiếu quyền cấp lại mật khẩu hội viên" },
        422: { description: "Hội viên chưa có email" },
      },
    },
  },
  "/members/{id}/emergency-contacts": {
    put: {
      tags: ["Members"],
      summary: "Thay thế liên hệ khẩn cấp",
      description: "Tối đa ba liên hệ và chỉ một liên hệ chính; API dùng fullName, relationship, phone, isPrimary.",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Danh sách liên hệ mới" },
        422: { description: "Có nhiều hơn một liên hệ chính hoặc dữ liệu không hợp lệ" },
      },
    },
  },
  "/staff": {
    get: {
      tags: ["Staff"],
      summary: "Danh sách nhân viên",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Danh sách nhân sự" }, 403: { description: "Thiếu quyền staff.manage" } },
    },
    post: {
      tags: ["Staff"],
      summary: "Tạo nhân viên và gửi thông tin đăng nhập qua email",
      security: [{ sessionCookie: [] }],
      responses: { 201: { description: "Nhân viên mới; temporaryPassword chỉ trả về khi không gửi được email" } },
    },
  },
  "/staff/{id}/account-credentials": {
    post: {
      tags: ["Staff"],
      summary: "Admin cấp lại mật khẩu tạm cho nhân viên",
      description:
        "Chỉ role Admin được thực hiện, kể cả khi role khác được cấp staff.manage. Thu hồi phiên cũ, buộc đổi mật khẩu khi đăng nhập; temporaryPassword chỉ trả về nếu email không gửi được.",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      responses: {
        200: { description: "Mật khẩu tạm đã được cấp lại" },
        403: { description: "Không phải Admin" },
        404: { description: "Nhân viên không tồn tại" },
      },
    },
  },
  "/staff/{id}": {
    get: {
      tags: ["Staff"],
      summary: "Chi tiết nhân viên",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { 200: { description: "Nhân viên" } },
    },
    patch: {
      tags: ["Staff"],
      summary: "Cập nhật nhân viên",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Đã cập nhật" } },
    },
  },
  "/staff/{id}/status": {
    patch: {
      tags: ["Staff"],
      summary: "Đình chỉ hoặc kích hoạt nhân viên",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Đã cập nhật trạng thái" } },
    },
  },
};
