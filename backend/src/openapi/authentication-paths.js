import { uuid, jsonBody } from "./contract-helpers.js";

export const authenticationPaths = {
  "/auth/profile": {
    get: {
      tags: ["Authentication"],
      summary: "Xem hồ sơ cá nhân theo vai trò",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Hồ sơ cá nhân, gồm profileSetupRequired để nhận biết bước hoàn thiện lần đầu" },
      },
    },
    patch: {
      tags: ["Authentication"],
      summary: "Cập nhật hồ sơ cá nhân",
      description:
        "Tất cả vai trò chỉ sửa họ tên, số điện thoại và ngày sinh của chính mình. Hội viên được sửa thêm giới tính và tối đa ba liên hệ khẩn cấp. Email, vai trò và trạng thái chỉ đọc. Lưu thành công sẽ kết thúc bước hoàn thiện hồ sơ lần đầu.",
      security: [{ sessionCookie: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["fullName", "phone", "dateOfBirth"],
              properties: {
                fullName: { type: "string", minLength: 2, maxLength: 120 },
                phone: { type: "string", pattern: "^(?:\\+84|0)\\d{9,10}$" },
                dateOfBirth: { type: ["string", "null"], format: "date" },
                avatarUrl: { type: ["string", "null"], format: "uri", maxLength: 2048 },
                gender: { type: ["string", "null"], maxLength: 30 },
                contacts: {
                  type: "array",
                  maxItems: 3,
                  items: {
                    type: "object",
                    required: ["fullName", "relationship", "phone", "isPrimary"],
                    properties: {
                      fullName: { type: "string", minLength: 2, maxLength: 120 },
                      relationship: { type: "string", minLength: 2, maxLength: 60 },
                      phone: { type: "string", pattern: "^(?:\\+84|0)\\d{9,10}$" },
                      isPrimary: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: { 200: { description: "Hồ sơ đã cập nhật" }, 422: { description: "Dữ liệu không hợp lệ" } },
    },
  },
  "/auth/profile/avatar/cloudinary/signature": {
    post: {
      tags: ["Authentication"],
      summary: "Cấp chữ ký Cloudinary ngắn hạn để tải ảnh đại diện của chính mình",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Thông số upload trực tiếp" },
        401: { description: "Cần đăng nhập" },
        503: { description: "Cloudinary chưa cấu hình" },
      },
    },
  },
  "/auth/register": {
    post: {
      tags: ["Auth"],
      summary: "Đăng ký hội viên công khai",
      description:
        "Khi CAPTCHA_ENABLED=true, captchaToken bắt buộc và được xác minh ở API bằng RECAPTCHA_SECRET_KEY.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } },
      },
      responses: {
        201: { description: "Đã tạo tài khoản chờ xác thực" },
        409: { description: "Email hoặc số điện thoại đã tồn tại" },
        422: { description: "Dữ liệu hoặc CAPTCHA không hợp lệ" },
      },
    },
  },
  "/auth/verification/confirm": {
    post: {
      tags: ["Auth"],
      summary: "Xác thực email",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/VerificationRequest" } } },
      },
      responses: { 200: { description: "Đã xác thực" }, 422: { description: "Mã không hợp lệ hoặc hết hạn" } },
    },
  },
  "/auth/verification/resend": {
    post: {
      tags: ["Auth"],
      summary: "Gửi lại mã xác thực",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/VerificationRecipient" } } },
      },
      responses: { 200: { description: "Đã gửi mã" } },
    },
  },
  "/auth/login": {
    post: {
      tags: ["Auth"],
      summary: "Đăng nhập cổng vận hành",
      description:
        "Dành cho Manager, Lễ tân, Coach và Hội viên. Tài khoản Admin bị từ chối và phải dùng /auth/admin/login tại admin.kineticsports.io.vn. CAPTCHA được server xác minh khi bật; TOTP đã đăng ký trả challenge riêng cho cổng vận hành.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
      },
      responses: {
        200: { description: "Session cookie hoặc MFA challenge" },
        401: { description: "Sai thông tin đăng nhập" },
        403: { description: "Tài khoản Admin, tài khoản chưa hoạt động hoặc Origin không được phép" },
        422: { description: "CAPTCHA thiếu, sai hoặc hết hạn" },
        429: { description: "Đăng nhập sai vượt giới hạn, thử lại sau cửa sổ thời gian cấu hình" },
      },
    },
  },
  "/auth/admin/login": {
    post: {
      tags: ["Auth"],
      summary: "Đăng nhập cổng Admin riêng",
      description:
        "Chỉ chấp nhận role admin. Endpoint dùng bởi admin.kineticsports.io.vn; tài khoản các role khác bị từ chối. CAPTCHA được server xác minh khi bật và TOTP trả challenge chỉ có thể hoàn tất tại /auth/admin/mfa/totp/verify.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
      },
      responses: {
        200: { description: "Session cookie hoặc MFA challenge Admin" },
        401: { description: "Sai thông tin đăng nhập" },
        403: { description: "Không phải Admin, tài khoản chưa hoạt động hoặc Origin không được phép" },
        422: { description: "CAPTCHA thiếu, sai hoặc hết hạn" },
      },
    },
  },
  "/auth/mfa/totp/enrollment": {
    post: {
      tags: ["Auth"],
      summary: "Bắt đầu đăng ký Authenticator",
      description:
        "Mọi role đang có phiên đăng nhập đều có thể tự bật TOTP. Secret và otpauthUri chỉ xuất hiện trong phản hồi này; không ghi vào log hay audit value.",
      security: [{ sessionCookie: [] }],
      responses: { 201: { description: "Enrollment TOTP và otpauth URI" } },
    },
  },
  "/auth/mfa/totp/enrollment/confirm": {
    post: {
      tags: ["Auth"],
      summary: "Xác nhận Authenticator",
      description:
        "Mã 6 số phải hợp lệ trong enrollment chưa hết hạn. Secret được lưu mã hóa và enrollment chỉ dùng một lần.",
      security: [{ sessionCookie: [] }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/TotpEnrollmentConfirmRequest" } } },
      },
      responses: {
        200: { description: "Đã kích hoạt TOTP" },
        422: { description: "Enrollment hết hạn hoặc mã không đúng" },
      },
    },
  },
  "/auth/mfa/totp/verify": {
    post: {
      tags: ["Auth"],
      summary: "Hoàn tất đăng nhập cổng vận hành bằng Authenticator",
      description:
        "Chỉ nhận challenge ID từ /auth/login. Challenge dùng một lần, hết hạn sau 5 phút; challenge Admin bị từ chối.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/TotpLoginVerifyRequest" } } },
      },
      responses: {
        200: { description: "Đã tạo phiên" },
        403: { description: "Challenge thuộc cổng Admin" },
        422: { description: "Challenge hết hạn/đã dùng hoặc mã không đúng" },
      },
    },
  },
  "/auth/admin/mfa/totp/verify": {
    post: {
      tags: ["Auth"],
      summary: "Hoàn tất đăng nhập cổng Admin bằng Authenticator",
      description: "Chỉ nhận challenge ID từ /auth/admin/login. Challenge cổng vận hành bị từ chối.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/TotpLoginVerifyRequest" } } },
      },
      responses: {
        200: { description: "Đã tạo phiên Admin" },
        403: { description: "Challenge thuộc cổng vận hành" },
        422: { description: "Challenge hết hạn/đã dùng hoặc mã không đúng" },
      },
    },
  },
  "/auth/logout": {
    post: {
      tags: ["Auth"],
      summary: "Đăng xuất",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Đã đăng xuất" }, 401: { description: "Chưa đăng nhập" } },
    },
  },
  "/auth/me": {
    get: {
      tags: ["Auth"],
      summary: "Lấy người dùng và quyền của phiên hiện tại",
      description:
        "user.mustChangePassword chặn chức năng trước khi đổi mật khẩu tạm; user.profileSetupRequired đưa tài khoản mới vào Hồ sơ. Hội viên tự đăng ký không phải đổi mật khẩu đã tự đặt.",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Phiên hợp lệ" }, 401: { description: "Phiên không hợp lệ" } },
    },
  },
  "/auth/registrations/pending": {
    get: {
      tags: ["Auth"],
      summary: "Danh sách đăng ký chờ duyệt",
      description: "Admin và Lễ tân có quyền registration.approve; Manager không có quyền này.",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Danh sách chờ duyệt" },
        403: { description: "Thiếu quyền registration.approve" },
      },
    },
  },
  "/auth/registrations/{userId}/approve": {
    post: {
      tags: ["Auth"],
      summary: "Admin hoặc Lễ tân duyệt tài khoản hội viên",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "userId", in: "path", required: true, schema: uuid }],
      responses: {
        200: { description: "Tài khoản đã kích hoạt" },
        403: { description: "Thiếu quyền registration.approve" },
      },
    },
  },
  "/auth/password/change": {
    post: {
      tags: ["Auth"],
      summary: "Đổi mật khẩu",
      description:
        "Cho phép đổi mật khẩu tạm ở lần đăng nhập đầu; giữ phiên hiện tại và thu hồi các phiên khác. user.mustChangePassword trở thành false.",
      security: [{ sessionCookie: [] }],
      requestBody: jsonBody({
        type: "object",
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string", format: "password" },
          newPassword: {
            type: "string",
            format: "password",
            minLength: 8,
            maxLength: 72,
            description: "Cần chữ hoa, chữ thường và chữ số. Tối đa 72 byte UTF-8; ký tự có dấu/emoji có thể chiếm nhiều byte.",
          },
        },
      }),
      responses: {
        200: { description: "Đã đổi mật khẩu" },
        401: { description: "Chưa đăng nhập" },
        409: { description: "Tài khoản hoặc mật khẩu đã thay đổi trong lúc xử lý" },
        422: { description: "Mật khẩu hiện tại hoặc mật khẩu mới không hợp lệ" },
      },
    },
  },
  "/auth/mfa/email/verify": {
    post: {
      tags: ["Auth"],
      summary: "Hoàn tất đăng nhập nhân viên bằng OTP email",
      description: "Chỉ chấp nhận challenge staff_login còn hạn của Coach/Lễ tân. Mã chỉ sử dụng một lần.",
      requestBody: jsonBody({ $ref: "#/components/schemas/TotpLoginVerifyRequest" }),
      responses: {
        200: { description: "Session cookie và quyền của nhân viên" },
        401: { description: "Tài khoản không hoạt động hoặc không đúng role" },
        422: { description: "Challenge hoặc mã không hợp lệ" },
      },
    },
  },
};
