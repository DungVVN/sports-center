import { uuid, jsonBody } from "./contract-helpers.js";

export const classesAttendancePaths = {
  "/classes/{id}/attendance": {
    get: {
      tags: ["Attendance"],
      summary: "Danh sách điểm danh lớp",
      description:
        "Yêu cầu quyền attendance.read. Coach chỉ xem lớp mình phụ trách; Admin xem mọi lớp; Manager và Lễ tân chỉ xem kết quả.",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Điểm danh" } },
    },
  },
  "/classes/{id}/attendance/submit": {
    post: {
      tags: ["Attendance"],
      summary: "Chốt điểm danh và gửi thông báo cho hội viên",
      description:
        "Admin hoặc Coach phụ trách được chốt trong thời gian buổi học sau khi mọi booking hợp lệ đã có trạng thái điểm danh. Mỗi buổi chỉ gửi thông báo một lần.",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      responses: {
        200: { description: "Đã chốt điểm danh và gửi thông báo" },
        403: { description: "Không phải Admin hoặc Coach phụ trách lớp" },
        422: { description: "Còn hội viên chưa được điểm danh hoặc ngoài thời gian buổi học" },
      },
    },
  },
  "/members/me/attendance": {
    get: {
      tags: ["Attendance"],
      summary: "Hội viên xem lịch sử điểm danh của mình",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Lịch sử điểm danh của tài khoản đăng nhập" },
        404: { description: "Tài khoản chưa có hồ sơ hội viên" },
      },
    },
  },
  "/attendance/check-in": {
    post: {
      tags: ["Attendance"],
      summary: "Điểm danh theo booking",
      description: "Admin hoặc Coach phụ trách có thể điểm danh trong thời gian buổi học.",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Đã điểm danh" },
        403: { description: "Không phải Admin hoặc Coach phụ trách" },
        422: { description: "Ngoài thời gian buổi học" },
      },
    },
  },
  "/attendance/{id}/check-out": {
    post: {
      tags: ["Attendance"],
      summary: "Check-out theo lượt điểm danh",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { 200: { description: "Đã check-out" } },
    },
  },
  "/attendance/{id}/corrections": {
    post: {
      tags: ["Attendance"],
      summary: "Sửa điểm danh",
      description:
        "Admin hoặc Coach phụ trách được sửa từ khi buổi học bắt đầu. Sau khi buổi học kết thúc, lý do là bắt buộc và được lưu audit.",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Đã sửa và audit" },
        403: { description: "Không phải Admin hoặc Coach phụ trách" },
        422: { description: "Sửa quá sớm hoặc thiếu lý do sau giờ học" },
      },
    },
  },
  "/classes/{id}/bookings": {
    get: {
      tags: ["Bookings"],
      summary: "Booking theo lớp",
      description:
        "Coach chỉ nhận học viên trong lớp mình phụ trách. Hội viên chỉ nhận booking của chính mình trong lớp.",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: {
        200: { description: "Danh sách booking theo phạm vi quyền" },
        403: { description: "Coach không phụ trách lớp" },
      },
    },
  },
  "/bookings": {
    get: {
      tags: ["Bookings"],
      summary: "Danh sách đặt chỗ",
      description:
        "Yêu cầu quyền booking.read. Hội viên chỉ xem lịch của mình; Coach chỉ xem lớp mình phụ trách; Admin, Lễ tân và Manager xem lịch vận hành, Manager chỉ đọc.",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "memberId", in: "query", schema: uuid }],
      responses: {
        200: { description: "Danh sách booking" },
        403: { description: "Không được xem lịch của hội viên khác" },
      },
    },
    post: {
      tags: ["Bookings"],
      summary: "Đặt chỗ hoặc vào danh sách chờ",
      description:
        "Yêu cầu quyền booking.write. Hội viên chỉ đặt cho chính mình; Admin/Lễ tân có thể đặt cho hội viên; Manager chỉ xem. Lớp chỉ được đặt một lần, quyền gói được kiểm tra tại lịch học và waitlist được thông báo.",
      security: [{ sessionCookie: [] }],
      requestBody: jsonBody({
        type: "object",
        required: ["classId"],
        properties: {
          memberId: { ...uuid, description: "Bắt buộc khi Admin/Lễ tân đặt thay hội viên" },
          classId: uuid,
        },
      }),
      responses: {
        201: { description: "Booking confirmed hoặc waitlisted" },
        409: { description: "Đã có booking còn hiệu lực" },
        422: { description: "Lớp không còn mở hoặc gói không đủ điều kiện tại lịch học" },
      },
    },
  },
  "/bookings/{id}/cancel": {
    patch: {
      tags: ["Bookings"],
      summary: "Hủy booking",
      description:
        "Hội viên chỉ hủy booking của mình và phải trước giờ học ít nhất 5 tiếng; Admin/Lễ tân có thể hủy cho hội viên. Hủy booking confirmed tự động đôn người đủ điều kiện đầu tiên trong waitlist.",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      requestBody: jsonBody({
        type: "object",
        required: ["reason"],
        properties: { reason: { type: "string", minLength: 3, maxLength: 500 } },
      }),
      responses: {
        200: { description: "Đã hủy" },
        403: { description: "Không được hủy booking của người khác" },
        422: { description: "Hội viên hủy quá muộn" },
      },
    },
  },
  "/classes": {
    get: {
      tags: ["Classes"],
      summary: "Danh sách lớp học",
      description:
        "Coach chỉ nhận các buổi học do chính mình phụ trách. Hội viên có thể xem lịch lớp công bố để đặt chỗ, nhưng dữ liệu hội viên khác không được trả về.",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Lớp học" } },
    },
    post: {
      tags: ["Classes"],
      summary: "Tạo lớp học nháp",
      description:
        "Chỉ nhận phòng và Coach đang hoạt động; sĩ số không vượt sức chứa phòng; thời gian kết thúc phải sau bắt đầu và không được trùng lịch Coach hoặc phòng.",
      security: [{ sessionCookie: [] }],
      responses: {
        201: { description: "Lớp học mới" },
        422: { description: "Phòng/Coach không khả dụng, lịch trùng hoặc thời gian không hợp lệ" },
      },
    },
  },
  "/classes/{id}": {
    patch: {
      tags: ["Classes"],
      summary: "Cập nhật lớp học",
      description:
        "Kiểm tra lại phòng/Coach còn hoạt động và sức chứa phòng. Không giảm sĩ số dưới số booking confirmed/attended; kiểm tra giảm sĩ số trong giao dịch khóa lớp.",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { 200: { description: "Đã cập nhật" } },
    },
  },
  "/classes/{id}/publish": {
    post: {
      tags: ["Classes"],
      summary: "Xuất bản lớp học",
      description: "Kiểm tra lại phòng và Coach còn hoạt động, sức chứa phòng và xung đột lịch trước khi công bố.",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Đã xuất bản" } },
    },
  },
  "/classes/{id}/change-requests": {
    post: {
      tags: ["Classes"],
      summary: "Coach đề xuất hủy hoặc đổi lịch lớp",
      description:
        "Chỉ Coach đang phụ trách lớp đã công bố được gửi yêu cầu. Đổi lịch được kiểm tra trùng Coach/phòng ngay khi gửi và khi duyệt.",
      security: [{ sessionCookie: [] }],
      responses: {
        201: { description: "Yêu cầu chờ lễ tân duyệt" },
        422: { description: "Thời gian không hợp lệ hoặc bị trùng lịch" },
      },
    },
  },
  "/class-change-requests": {
    get: {
      tags: ["Classes"],
      summary: "Admin/Lễ tân xem yêu cầu thay đổi lớp",
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
        200: { description: "Danh sách yêu cầu thay đổi lớp" },
        403: { description: "Thiếu quyền class.change.review" },
        422: { description: "Giá trị status không hợp lệ" },
      },
    },
  },
  "/class-change-requests/{id}": {
    patch: {
      tags: ["Classes"],
      summary: "Admin/Lễ tân duyệt hoặc từ chối thay đổi lớp",
      description:
        "Yêu cầu quyền class.change.review. Khi duyệt, booking confirmed/waitlisted bị hủy và hội viên được thông báo để đặt lại; khi từ chối, Coach nhận thông báo. Quyết định, thay đổi lớp, booking, thông báo và audit được ghi trong một transaction; lỗi bất kỳ bước nào đều rollback. Yêu cầu chỉ được xử lý một lần, kể cả khi có nhiều người duyệt đồng thời.",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Đã xử lý yêu cầu và thông báo người liên quan" },
        422: { description: "Yêu cầu/lớp không còn khả dụng hoặc lịch bị trùng" },
      },
    },
  },
  "/rooms": {
    get: {
      tags: ["Classes"],
      summary: "Danh sách phòng",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Phòng đang hoạt động" } },
    },
  },
  "/coaches": {
    get: {
      tags: ["Classes"],
      summary: "Danh sách huấn luyện viên",
      description:
        "Coach chỉ nhận hồ sơ của mình; Hội viên chỉ nhận Coach đang được phân công. Admin, Lễ tân và Manager nhận danh sách vận hành đầy đủ.",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "HLV trong phạm vi quyền" } },
    },
  },
};
