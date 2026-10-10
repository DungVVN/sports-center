import { uuid, publicPackageResponse } from "./contract-helpers.js";

export const membershipPaths = {
  "/public/membership-packages": {
    get: {
      tags: ["Memberships"],
      summary: "Gói hội viên công khai trên landing page",
      description:
        "Không cần đăng nhập. Chỉ trả các gói BASIC, STANDARD, PREMIUM đang hoạt động; không gồm gói thử nghiệm. Đăng ký tài khoản không tự mua hoặc kích hoạt gói.",
      security: [],
      responses: {
        200: {
          description: "Danh sách gói công khai, có thể rỗng",
          content: { "application/json": { schema: publicPackageResponse } },
        },
        500: { description: "Không thể tải danh sách gói" },
      },
    },
  },
  "/membership-packages": {
    get: {
      tags: ["Memberships"],
      summary: "Danh sách gói tập và quyền sử dụng",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Gói tập đang cấu hình" } },
    },
    post: {
      tags: ["Memberships"],
      summary: "Tạo gói tập",
      description: "Yêu cầu quyền membership.package.manage.",
      security: [{ sessionCookie: [] }],
      responses: { 201: { description: "Gói tập mới" }, 403: { description: "Thiếu quyền quản trị gói tập" } },
    },
  },
  "/membership-packages/{id}": {
    patch: {
      tags: ["Memberships"],
      summary: "Cập nhật gói tập",
      description: "Yêu cầu quyền membership.package.manage.",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Gói tập đã cập nhật" },
        403: { description: "Thiếu quyền quản trị gói tập" },
      },
    },
  },
  "/members/me/memberships": {
    get: {
      tags: ["Memberships"],
      summary: "Hội viên xem các gói tập của chính mình",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Danh sách gói của tài khoản đăng nhập" } },
    },
  },
  "/memberships/{id}/freeze-requests": {
    post: {
      tags: ["Memberships"],
      summary: "Hội viên gửi yêu cầu đóng băng tối đa 3 tháng",
      description:
        "Yêu cầu quyền membership.freeze.request. Hội viên chỉ có thể yêu cầu cho gói đang hoạt động của chính mình; sau khi Lễ tân duyệt, hệ thống cộng bù đúng số ngày đóng băng.",
      security: [{ sessionCookie: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["startsOn", "endsOn", "reason"],
              properties: {
                startsOn: { type: "string", format: "date" },
                endsOn: { type: "string", format: "date" },
                reason: { type: "string", minLength: 3, maxLength: 500 },
              },
            },
          },
        },
      },
      responses: {
        201: { description: "Yêu cầu chờ lễ tân duyệt" },
        403: { description: "Thiếu quyền hoặc không sở hữu gói tập" },
        409: { description: "Đã dùng lượt đóng băng" },
        422: { description: "Không đủ điều kiện hoặc vượt quá 3 tháng" },
      },
    },
  },
  "/membership-freeze-requests": {
    get: {
      tags: ["Memberships"],
      summary: "Danh sách yêu cầu đóng băng để duyệt",
      description: "Yêu cầu quyền membership.freeze.review; trả về hội viên và gói liên quan.",
      security: [{ sessionCookie: [] }],
      parameters: [
        {
          name: "status",
          in: "query",
          description: "Lọc theo trạng thái; mặc định pending. Chỉ nhận pending, approved hoặc rejected.",
          schema: { type: "string", enum: ["pending", "approved", "rejected"], default: "pending" },
        },
      ],
      responses: {
        200: { description: "Hàng chờ duyệt" },
        403: { description: "Thiếu quyền duyệt đóng băng" },
        422: { description: "Giá trị status không hợp lệ" },
      },
    },
  },
  "/membership-freeze-requests/{id}": {
    patch: {
      tags: ["Memberships"],
      summary: "Admin hoặc Lễ tân duyệt/từ chối đóng băng",
      description:
        "Yêu cầu quyền membership.freeze.review. Khi duyệt, hạn dùng được cộng bù theo số ngày và lifecycle job chuyển gói sang frozen đúng khoảng thời gian đã duyệt.",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Đã xử lý và gửi thông báo cho hội viên" },
        403: { description: "Thiếu quyền duyệt đóng băng" },
        422: { description: "Gói hoặc yêu cầu không còn đủ điều kiện" },
      },
    },
  },
  "/memberships/{id}/cancel-pending-renewal": {
    patch: {
      tags: ["Memberships"],
      summary: "Admin hoặc Lễ tân hủy gia hạn chờ thanh toán",
      description: "Yêu cầu quyền membership.assign.",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Đã hủy yêu cầu gia hạn" },
        403: { description: "Thiếu quyền tạo gói cho hội viên" },
      },
    },
  },
  "/members/{id}/memberships": {
    get: {
      tags: ["Memberships"],
      summary: "Lịch sử gói tập của hội viên",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      responses: { 200: { description: "Danh sách membership" } },
    },
    post: {
      tags: ["Memberships"],
      summary: "Admin hoặc Lễ tân gán gói cho hội viên",
      description: "Yêu cầu quyền membership.assign. Gói miễn phí tự kích hoạt; gói trả phí chờ thanh toán.",
      security: [{ sessionCookie: [] }],
      responses: {
        201: { description: "Membership active nếu gói miễn phí, pending_payment nếu có giá" },
        403: { description: "Thiếu quyền tạo gói cho hội viên" },
      },
    },
  },
};
