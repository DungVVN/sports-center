import { env } from "../config/env.js";

const uuid = { type: "string", format: "uuid" };
const jsonBody = (schema) => ({ required: true, content: { "application/json": { schema } } });
const publicPackageResponse = {
  type: "object",
  required: ["success", "data"],
  properties: {
    success: { type: "boolean", const: true },
    data: {
      type: "array",
      items: {
        type: "object",
        required: ["code", "name", "priceVnd", "durationDays", "benefits"],
        properties: {
          code: { type: "string", enum: ["BASIC", "STANDARD", "PREMIUM"] },
          name: { type: "string" },
          priceVnd: { type: "string", pattern: "^[0-9]+$", example: "490000" },
          durationDays: { type: "integer", minimum: 1 },
          benefits: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Sports Center API",
    version: "0.1.0",
    description: "API contract for Sports Center. Admin receives every permission code; identity-bound Member/Coach endpoints still enforce their own role scope. A temporary-password account must change password before normal API access.",
  },
  servers: [{ url: env.apiBasePath }],
  paths: {
    "/public/membership-packages": {
      get: {
        tags: ["Memberships"],
        summary: "Gói hội viên công khai trên landing page",
        description: "Không cần đăng nhập. Chỉ trả các gói BASIC, STANDARD, PREMIUM đang hoạt động; không gồm gói thử nghiệm. Đăng ký tài khoản không tự mua hoặc kích hoạt gói.",
        security: [],
        responses: {
          200: { description: "Danh sách gói công khai, có thể rỗng", content: { "application/json": { schema: publicPackageResponse } } },
          500: { description: "Không thể tải danh sách gói" },
        },
      },
    },
    "/members/me": { get: { tags: ["Members"], summary: "Hội viên xem hồ sơ của chính mình", security: [{ sessionCookie: [] }], responses: { 200: { description: "Hồ sơ cá nhân" } } } },
    "/auth/profile": { get: { tags: ["Authentication"], summary: "Xem hồ sơ cá nhân theo vai trò", security: [{ sessionCookie: [] }], responses: { 200: { description: "Hồ sơ cá nhân, gồm profileSetupRequired để nhận biết bước hoàn thiện lần đầu" } } }, patch: { tags: ["Authentication"], summary: "Cập nhật hồ sơ cá nhân", description: "Tất cả vai trò chỉ sửa họ tên, số điện thoại và ngày sinh của chính mình. Hội viên được sửa thêm giới tính và tối đa ba liên hệ khẩn cấp. Email, vai trò và trạng thái chỉ đọc. Lưu thành công sẽ kết thúc bước hoàn thiện hồ sơ lần đầu.", security: [{ sessionCookie: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["fullName", "phone", "dateOfBirth"], properties: { fullName: { type: "string", minLength: 2, maxLength: 120 }, phone: { type: "string", pattern: "^(?:\\+84|0)\\d{9,10}$" }, dateOfBirth: { type: ["string", "null"], format: "date" }, avatarUrl: { type: ["string", "null"], format: "uri", maxLength: 2048 }, gender: { type: ["string", "null"], maxLength: 30 }, contacts: { type: "array", maxItems: 3, items: { type: "object", required: ["fullName", "relationship", "phone", "isPrimary"], properties: { fullName: { type: "string", minLength: 2, maxLength: 120 }, relationship: { type: "string", minLength: 2, maxLength: 60 }, phone: { type: "string", pattern: "^(?:\\+84|0)\\d{9,10}$" }, isPrimary: { type: "boolean" } } } } } } } } }, responses: { 200: { description: "Hồ sơ đã cập nhật" }, 422: { description: "Dữ liệu không hợp lệ" } } } },
    "/members/{id}/coach-assignments": { get: { tags: ["Coach assignments"], summary: "Lịch sử coach của hội viên", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { 200: { description: "Lịch sử" }, 403: { description: "Thiếu quyền member.write" }, 404: { description: "Không tìm thấy hội viên" } } }, post: { tags: ["Coach assignments"], summary: "Đổi coach chính và giữ lịch sử hiệu lực", description: "Coach cũ kết thúc vào ngày trước effectiveFrom, nên không có ngày chồng quyền. Chỉ Coach đang active mới được chọn và ngày hiệu lực không nằm trong quá khứ.", security: [{ sessionCookie: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["coachUserId", "effectiveFrom"], properties: { coachUserId: { type: "string", format: "uuid" }, effectiveFrom: { type: "string", format: "date" }, reason: { type: "string", maxLength: 500 } } } } } }, responses: { 201: { description: "Đã phân công" }, 404: { description: "Không tìm thấy hội viên" }, 422: { description: "Coach không khả dụng hoặc ngày hiệu lực không hợp lệ" } } } },
    "/audit-logs": { get: { tags: ["Audit"], summary: "Nhật ký kiểm toán", security: [{ sessionCookie: [] }], parameters: [{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } }, { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } }], responses: { 200: { description: "Danh sách phân trang, bao gồm actor.id, actor.name và pagination { page, pageSize, total, totalPages }" } } } },
    "/dashboards/{role}": { get: { tags: ["Dashboard"], summary: "Tổng quan và so sánh vận hành theo vai trò", description: "role phải khớp đúng role của phiên đăng nhập. Admin và Manager có thể lọc day, week, month, quarter hoặc year; mọi KPI so sánh với kỳ liền trước có cùng độ dài. Doanh thu chỉ cộng phiếu thu tiền mặt đã xác nhận theo paid_at. Các vai trò khác chỉ nhận dữ liệu trong phạm vi của họ.", security: [{ sessionCookie: [] }], parameters: [{ name: "period", in: "query", schema: { type: "string", enum: ["day", "week", "month", "quarter", "year", "custom"], default: "day" } }, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: { 200: { description: "KPI, biến động so với kỳ trước, xu hướng doanh thu và cảnh báo theo phạm vi quyền" }, 403: { description: "Không được xem dashboard của role khác" } } } },
    "/notifications": { get: { tags: ["Notifications"], summary: "Thông báo trong hệ thống", description: "Bao gồm thông báo vòng đời gói tập, booking, điểm danh, thanh toán và hỗ trợ. Khi người nhận bật email, notification chưa gửi được email worker lấy theo cơ chế claim/retry giới hạn để tránh gửi trùng.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Thông báo của tài khoản đăng nhập" } } } },
    "/notifications/{id}/read": { patch: { tags: ["Notifications"], summary: "Đánh dấu đã đọc", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã đọc" } } } },
    "/notification-preferences": { get: { tags: ["Notifications"], summary: "Xem tùy chọn nhận email", security: [{ sessionCookie: [] }], responses: { 200: { description: "email_enabled của tài khoản hiện tại" } } }, put: { tags: ["Notifications"], summary: "Cập nhật tùy chọn nhận email", security: [{ sessionCookie: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["emailEnabled"], properties: { emailEnabled: { type: "boolean" } } } } } }, responses: { 200: { description: "Tùy chọn đã lưu" }, 422: { description: "emailEnabled phải là boolean" } } } },
    "/support-tickets": { get: { tags: ["Support"], summary: "Danh sách yêu cầu hỗ trợ theo phạm vi", description: "Hội viên chỉ nhận ticket của mình; Admin, Manager và Lễ tân nhận hàng chờ vận hành.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Danh sách ticket" }, 403: { description: "Vai trò không được xử lý hỗ trợ" } } }, post: { tags: ["Support"], summary: "Hội viên tạo yêu cầu hỗ trợ", security: [{ sessionCookie: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["subject", "body"], properties: { subject: { type: "string", minLength: 3, maxLength: 200 }, body: { type: "string", minLength: 3, maxLength: 5000 }, priority: { type: "string", enum: ["low", "normal", "high"] } } } } } }, responses: { 201: { description: "Ticket đã tạo" } } } },
    "/support-tickets/{id}": { get: { tags: ["Support"], summary: "Xem chi tiết ticket và phản hồi", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { 200: { description: "Ticket và lịch sử phản hồi" }, 403: { description: "Ngoài phạm vi ticket" } } } },
    "/support-tickets/{id}/assign-self": { post: { tags: ["Support"], summary: "Admin, Manager hoặc Lễ tân nhận phụ trách ticket", security: [{ sessionCookie: [] }], responses: { 200: { description: "Ticket chuyển sang in_progress" }, 403: { description: "Chỉ Admin, Manager hoặc Lễ tân" } } } },
    "/support-tickets/{id}/responses": { post: { tags: ["Support"], summary: "Phản hồi ticket và tạo thông báo cho hội viên", description: "Phản hồi của Admin, Manager hoặc Lễ tân tạo notification cho chủ ticket; email worker chỉ gửi nếu hội viên đang bật email.", security: [{ sessionCookie: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["body"], properties: { body: { type: "string", minLength: 1, maxLength: 5000 }, status: { type: "string", enum: ["open", "in_progress", "resolved", "closed"] } } } } } }, responses: { 200: { description: "Phản hồi và thông báo đã tạo" }, 403: { description: "Chỉ Admin, Manager hoặc Lễ tân" } } } },
    "/reports/revenue": { get: { tags: ["Reports"], summary: "Doanh thu và trạng thái phiếu thu", description: "Doanh thu chỉ cộng payment paid theo paid_at. createdSummary và paymentStatuses phản ánh giao dịch được tạo trong khoảng lọc; trend trả thực thu theo từng ngày. Yêu cầu quyền report.read.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Thực thu, giá trị giao dịch, phần chờ xác nhận, tỷ lệ hoàn tất và xu hướng theo ngày" }, 403: { description: "Thiếu quyền report.read" } } } },
    "/reports/attendance": { get: { tags: ["Reports"], summary: "Báo cáo điểm danh", description: "Trả đủ trạng thái, tổng lượt, tỷ lệ tham gia và xu hướng theo ngày trong khoảng lọc. Yêu cầu quyền report.read.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Tổng hợp và xu hướng điểm danh" }, 403: { description: "Thiếu quyền report.read" } } } },
    "/reports/{type}/export": { get: { tags: ["Reports"], summary: "Xuất báo cáo CSV", description: "Xuất báo cáo doanh thu hoặc điểm danh theo các bộ lọc giống API báo cáo. Yêu cầu quyền report.read.", security: [{ sessionCookie: [] }], parameters: [{ name: "type", in: "path", required: true, schema: { type: "string", enum: ["revenue", "attendance"] } }, { name: "period", in: "query", schema: { type: "string", enum: ["day", "week", "month", "quarter", "year", "custom"], default: "day" } }, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }, { name: "coachUserId", in: "query", schema: { type: "string", format: "uuid" } }], responses: { 200: { description: "Tệp CSV UTF-8 có BOM", content: { "text/csv": { schema: { type: "string", format: "binary" } } } }, 403: { description: "Thiếu quyền report.read" }, 422: { description: "Bộ lọc hoặc loại báo cáo không hợp lệ" } } } },
    "/ai-assist/suggestions": { get: { tags: ["AI assist"], summary: "Coach xem bản nháp gợi ý AI", description: "Chỉ Coach xem được gợi ý tạo từ lịch, booking, điểm danh, giáo án và gói tập sắp hết hạn. Đây không phải chatbot hay tư vấn y khoa.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Bản nháp cần Coach rà soát" }, 403: { description: "Chỉ Coach có thể xem gợi ý" } } } },
    "/ai-assist/deliveries": { post: { tags: ["AI assist"], summary: "Coach duyệt và gửi hướng dẫn AI", description: "Coach có thể chỉnh nội dung trước khi gửi. Hệ thống kiểm tra hội viên trong scope Coach, lưu bản gửi, tạo thông báo cho hội viên và audit hành động.", security: [{ sessionCookie: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["memberId", "subject", "body"], properties: { memberId: { type: "string", format: "uuid" }, subject: { type: "string", minLength: 3, maxLength: 160 }, body: { type: "string", minLength: 3, maxLength: 1000 } } } } } }, responses: { 201: { description: "Đã lưu và gửi hướng dẫn được Coach duyệt" }, 403: { description: "Coach không có quyền hoặc hội viên ngoài scope" }, 422: { description: "Nội dung không hợp lệ" } } } },
    "/training-templates": { get: { tags: ["Training"], summary: "Mẫu giáo án", security: [{ sessionCookie: [] }], responses: { 200: { description: "Mẫu" } } }, post: { tags: ["Training"], summary: "Tạo mẫu giáo án", description: "Yêu cầu quyền training.template.manage.", security: [{ sessionCookie: [] }], responses: { 201: { description: "Mẫu mới" }, 403: { description: "Thiếu quyền quản lý mẫu giáo án" } } } },
    "/members/me/training": { get: { tags: ["Training"], summary: "Hội viên xem giáo án và kết quả của mình", security: [{ sessionCookie: [] }], responses: { 200: { description: "Giáo án và kết quả read-only của hội viên" }, 404: { description: "Tài khoản chưa có hồ sơ hội viên" } } } },
    "/training-members": { get: { tags: ["Training"], summary: "Hội viên đủ scope để lập giáo án", description: "Coach chỉ nhận hội viên trong phạm vi được phân công/lớp phụ trách; Admin và Manager nhận danh sách vận hành đầy đủ.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Hội viên có thể chọn" }, 403: { description: "Thiếu quyền training.write" } } } },
    "/training-plans": { get: { tags: ["Training"], summary: "Danh sách giáo án", security: [{ sessionCookie: [] }], responses: { 200: { description: "Giáo án" } } }, post: { tags: ["Training"], summary: "Tạo giáo án cá nhân", security: [{ sessionCookie: [] }], responses: { 201: { description: "Giáo án mới" } } } },
    "/training-plans/{id}": { patch: { tags: ["Training"], summary: "Cập nhật giáo án", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã cập nhật" } } } },
    "/training-results": { post: { tags: ["Training"], summary: "Ghi nhận kết quả tập", security: [{ sessionCookie: [] }], responses: { 201: { description: "Kết quả mới" } } } },
    "/payments": { get: { tags: ["Payments"], summary: "Danh sách phiếu thu", description: "Yêu cầu quyền payment.read. Manager chỉ xem; Admin và Lễ tân có thể thu tiền.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Phiếu thu kèm hội viên và gói đã gắn" } } }, post: { tags: ["Payments"], summary: "Admin hoặc Lễ tân lập phiếu thu hoặc link PayOS", description: "Yêu cầu quyền payment.record. Nếu gắn membership, amountVnd phải khớp giá snapshot; payment và event được ghi nguyên tử. Provider payos trả checkoutUrl/QR; chỉ webhook đã xác thực mới kích hoạt gói online.", security: [{ sessionCookie: [] }], responses: { 201: { description: "Phiếu thu chờ xác nhận hoặc checkout URL" }, 422: { description: "Membership không đủ điều kiện hoặc số tiền không khớp giá gói" }, 503: { description: "PayOS hoặc HTTPS return origin chưa cấu hình" } } } },
    "/payments/callbacks/payos": { post: { tags: ["Payments"], summary: "Webhook PayOS", description: "Callback server-to-server, không dùng cookie. Backend kiểm tra chữ ký SDK PayOS, đối chiếu orderCode/amount với phiếu pending và xử lý idempotent trước khi kích hoạt membership.", responses: { 200: { description: "Đã nhận callback" }, 401: { description: "Signature webhook không hợp lệ" }, 422: { description: "Callback không khớp giao dịch" } } } },
    "/members/me/payments": { get: { tags: ["Payments"], summary: "Hội viên xem giao dịch của mình", security: [{ sessionCookie: [] }], responses: { 200: { description: "Lịch sử giao dịch read-only" }, 404: { description: "Tài khoản chưa có hồ sơ hội viên" } } } },
    "/payments/{id}": { get: { tags: ["Payments"], summary: "Chi tiết giao dịch", description: "Yêu cầu quyền payment.read.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Giao dịch" } } } },
    "/payments/{id}/confirm": { post: { tags: ["Payments"], summary: "Admin hoặc Lễ tân xác nhận tiền mặt/chuyển khoản", description: "Yêu cầu quyền payment.record. Không xác nhận thủ công thanh toán online. Chuyển khoản paid cần reconciliationNote tối thiểu 10 ký tự; audit lưu lý do đối soát.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã xác nhận tiền mặt hoặc chuyển khoản; gói được kích hoạt và hội viên được thông báo" }, 422: { description: "Thiếu ghi chú đối soát hoặc thanh toán trực tuyến phải chờ webhook" } } } },
    "/classes/{id}/attendance": { get: { tags: ["Attendance"], summary: "Danh sách điểm danh lớp", description: "Yêu cầu quyền attendance.read. Coach chỉ xem lớp mình phụ trách; Admin xem mọi lớp; Manager và Lễ tân chỉ xem kết quả.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Điểm danh" } } } },
    "/classes/{id}/attendance/submit": { post: { tags: ["Attendance"], summary: "Chốt điểm danh và gửi thông báo cho hội viên", description: "Admin hoặc Coach phụ trách được chốt trong thời gian buổi học sau khi mọi booking hợp lệ đã có trạng thái điểm danh. Mỗi buổi chỉ gửi thông báo một lần.", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: uuid }], responses: { 200: { description: "Đã chốt điểm danh và gửi thông báo" }, 403: { description: "Không phải Admin hoặc Coach phụ trách lớp" }, 422: { description: "Còn hội viên chưa được điểm danh hoặc ngoài thời gian buổi học" } } } },
    "/members/me/attendance": { get: { tags: ["Attendance"], summary: "Hội viên xem lịch sử điểm danh của mình", security: [{ sessionCookie: [] }], responses: { 200: { description: "Lịch sử điểm danh của tài khoản đăng nhập" }, 404: { description: "Tài khoản chưa có hồ sơ hội viên" } } } },
    "/attendance/check-in": { post: { tags: ["Attendance"], summary: "Điểm danh theo booking", description: "Admin hoặc Coach phụ trách có thể điểm danh trong thời gian buổi học.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã điểm danh" }, 403: { description: "Không phải Admin hoặc Coach phụ trách" }, 422: { description: "Ngoài thời gian buổi học" } } } },
    "/attendance/{id}/check-out": { post: { tags: ["Attendance"], summary: "Check-out theo lượt điểm danh", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { 200: { description: "Đã check-out" } } } },
    "/attendance/{id}/corrections": { post: { tags: ["Attendance"], summary: "Sửa điểm danh", description: "Admin hoặc Coach phụ trách được sửa từ khi buổi học bắt đầu. Sau khi buổi học kết thúc, lý do là bắt buộc và được lưu audit.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã sửa và audit" }, 403: { description: "Không phải Admin hoặc Coach phụ trách" }, 422: { description: "Sửa quá sớm hoặc thiếu lý do sau giờ học" } } } },
    "/classes/{id}/bookings": { get: { tags: ["Bookings"], summary: "Booking theo lớp", description: "Coach chỉ nhận học viên trong lớp mình phụ trách. Hội viên chỉ nhận booking của chính mình trong lớp.", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { 200: { description: "Danh sách booking theo phạm vi quyền" }, 403: { description: "Coach không phụ trách lớp" } } } },
    "/bookings": { get: { tags: ["Bookings"], summary: "Danh sách đặt chỗ", description: "Yêu cầu quyền booking.read. Hội viên chỉ xem lịch của mình; Coach chỉ xem lớp mình phụ trách; Admin, Lễ tân và Manager xem lịch vận hành, Manager chỉ đọc.", security: [{ sessionCookie: [] }], parameters: [{ name: "memberId", in: "query", schema: uuid }], responses: { 200: { description: "Danh sách booking" }, 403: { description: "Không được xem lịch của hội viên khác" } } }, post: { tags: ["Bookings"], summary: "Đặt chỗ hoặc vào danh sách chờ", description: "Yêu cầu quyền booking.write. Hội viên chỉ đặt cho chính mình; Admin/Lễ tân có thể đặt cho hội viên; Manager chỉ xem. Lớp chỉ được đặt một lần, quyền gói được kiểm tra tại lịch học và waitlist được thông báo.", security: [{ sessionCookie: [] }], requestBody: jsonBody({ type: "object", required: ["classId"], properties: { memberId: { ...uuid, description: "Bắt buộc khi Admin/Lễ tân đặt thay hội viên" }, classId: uuid } }), responses: { 201: { description: "Booking confirmed hoặc waitlisted" }, 409: { description: "Đã có booking còn hiệu lực" }, 422: { description: "Lớp không còn mở hoặc gói không đủ điều kiện tại lịch học" } } } },
    "/bookings/{id}/cancel": { patch: { tags: ["Bookings"], summary: "Hủy booking", description: "Hội viên chỉ hủy booking của mình và phải trước giờ học ít nhất 5 tiếng; Admin/Lễ tân có thể hủy cho hội viên. Hủy booking confirmed tự động đôn người đủ điều kiện đầu tiên trong waitlist.", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: uuid }], requestBody: jsonBody({ type: "object", required: ["reason"], properties: { reason: { type: "string", minLength: 3, maxLength: 500 } } }), responses: { 200: { description: "Đã hủy" }, 403: { description: "Không được hủy booking của người khác" }, 422: { description: "Hội viên hủy quá muộn" } } } },
    "/classes": { get: { tags: ["Classes"], summary: "Danh sách lớp học", description: "Coach chỉ nhận các buổi học do chính mình phụ trách. Hội viên có thể xem lịch lớp công bố để đặt chỗ, nhưng dữ liệu hội viên khác không được trả về.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Lớp học" } } }, post: { tags: ["Classes"], summary: "Tạo lớp học nháp", description: "Chỉ nhận phòng và Coach đang hoạt động; thời gian kết thúc phải sau bắt đầu và không được trùng lịch Coach hoặc phòng.", security: [{ sessionCookie: [] }], responses: { 201: { description: "Lớp học mới" }, 422: { description: "Phòng/Coach không khả dụng, lịch trùng hoặc thời gian không hợp lệ" } } } },
    "/classes/{id}": { patch: { tags: ["Classes"], summary: "Cập nhật lớp học", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { 200: { description: "Đã cập nhật" } } } },
    "/classes/{id}/publish": { post: { tags: ["Classes"], summary: "Xuất bản lớp học", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã xuất bản" } } } },
    "/classes/{id}/change-requests": { post: { tags: ["Classes"], summary: "Coach đề xuất hủy hoặc đổi lịch lớp", description: "Chỉ Coach đang phụ trách lớp đã công bố được gửi yêu cầu. Đổi lịch được kiểm tra trùng Coach/phòng ngay khi gửi và khi duyệt.", security: [{ sessionCookie: [] }], responses: { 201: { description: "Yêu cầu chờ lễ tân duyệt" }, 422: { description: "Thời gian không hợp lệ hoặc bị trùng lịch" } } } },
    "/class-change-requests": { get: { tags: ["Classes"], summary: "Admin/Lễ tân xem yêu cầu thay đổi lớp", security: [{ sessionCookie: [] }], parameters: [{ name: "status", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected"], default: "pending" } }], responses: { 200: { description: "Danh sách yêu cầu thay đổi lớp" }, 403: { description: "Thiếu quyền class.change.review" } } } },
    "/class-change-requests/{id}": { patch: { tags: ["Classes"], summary: "Admin/Lễ tân duyệt hoặc từ chối thay đổi lớp", description: "Yêu cầu quyền class.change.review. Khi duyệt, booking hiện có bị hủy và hội viên được thông báo để đặt lại; khi từ chối, Coach nhận thông báo.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã xử lý yêu cầu và thông báo người liên quan" }, 422: { description: "Yêu cầu/lớp không còn khả dụng hoặc lịch bị trùng" } } } },
    "/rooms": { get: { tags: ["Classes"], summary: "Danh sách phòng", security: [{ sessionCookie: [] }], responses: { 200: { description: "Phòng đang hoạt động" } } } },
    "/coaches": { get: { tags: ["Classes"], summary: "Danh sách huấn luyện viên", description: "Coach chỉ nhận hồ sơ của mình; Hội viên chỉ nhận Coach đang được phân công. Admin, Lễ tân và Manager nhận danh sách vận hành đầy đủ.", security: [{ sessionCookie: [] }], responses: { 200: { description: "HLV trong phạm vi quyền" } } } },
    "/membership-packages": { get: { tags: ["Memberships"], summary: "Danh sách gói tập và quyền sử dụng", security: [{ sessionCookie: [] }], responses: { 200: { description: "Gói tập đang cấu hình" } } }, post: { tags: ["Memberships"], summary: "Tạo gói tập", description: "Yêu cầu quyền membership.package.manage.", security: [{ sessionCookie: [] }], responses: { 201: { description: "Gói tập mới" }, 403: { description: "Thiếu quyền quản trị gói tập" } } } },
    "/membership-packages/{id}": { patch: { tags: ["Memberships"], summary: "Cập nhật gói tập", description: "Yêu cầu quyền membership.package.manage.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Gói tập đã cập nhật" }, 403: { description: "Thiếu quyền quản trị gói tập" } } } },
    "/members/me/memberships": { get: { tags: ["Memberships"], summary: "Hội viên xem các gói tập của chính mình", security: [{ sessionCookie: [] }], responses: { 200: { description: "Danh sách gói của tài khoản đăng nhập" } } } },
    "/memberships/{id}/freeze-requests": { post: { tags: ["Memberships"], summary: "Hội viên gửi yêu cầu đóng băng tối đa 3 tháng", description: "Yêu cầu quyền membership.freeze.request. Hội viên chỉ có thể yêu cầu cho gói đang hoạt động của chính mình; sau khi Lễ tân duyệt, hệ thống cộng bù đúng số ngày đóng băng.", security: [{ sessionCookie: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["startsOn", "endsOn", "reason"], properties: { startsOn: { type: "string", format: "date" }, endsOn: { type: "string", format: "date" }, reason: { type: "string", minLength: 3, maxLength: 500 } } } } } }, responses: { 201: { description: "Yêu cầu chờ lễ tân duyệt" }, 403: { description: "Thiếu quyền hoặc không sở hữu gói tập" }, 409: { description: "Đã dùng lượt đóng băng" }, 422: { description: "Không đủ điều kiện hoặc vượt quá 3 tháng" } } } },
    "/membership-freeze-requests": { get: { tags: ["Memberships"], summary: "Danh sách yêu cầu đóng băng để duyệt", description: "Yêu cầu quyền membership.freeze.review; trả về hội viên và gói liên quan.", security: [{ sessionCookie: [] }], parameters: [{ name: "status", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected"], default: "pending" } }], responses: { 200: { description: "Hàng chờ duyệt" }, 403: { description: "Thiếu quyền duyệt đóng băng" } } } },
    "/membership-freeze-requests/{id}": { patch: { tags: ["Memberships"], summary: "Admin hoặc Lễ tân duyệt/từ chối đóng băng", description: "Yêu cầu quyền membership.freeze.review. Khi duyệt, hạn dùng được cộng bù theo số ngày và lifecycle job chuyển gói sang frozen đúng khoảng thời gian đã duyệt.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã xử lý và gửi thông báo cho hội viên" }, 403: { description: "Thiếu quyền duyệt đóng băng" }, 422: { description: "Gói hoặc yêu cầu không còn đủ điều kiện" } } } },
    "/memberships/{id}/cancel-pending-renewal": { patch: { tags: ["Memberships"], summary: "Admin hoặc Lễ tân hủy gia hạn chờ thanh toán", description: "Yêu cầu quyền membership.assign.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã hủy yêu cầu gia hạn" }, 403: { description: "Thiếu quyền tạo gói cho hội viên" } } } },
    "/members/{id}/memberships": { get: { tags: ["Memberships"], summary: "Lịch sử gói tập của hội viên", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: uuid }], responses: { 200: { description: "Danh sách membership" } } }, post: { tags: ["Memberships"], summary: "Admin hoặc Lễ tân tạo gói chờ thanh toán", description: "Yêu cầu quyền membership.assign.", security: [{ sessionCookie: [] }], responses: { 201: { description: "Membership pending_payment" }, 403: { description: "Thiếu quyền tạo gói cho hội viên" } } } },
    "/members": { get: { tags: ["Members"], summary: "Danh sách hội viên", description: "Danh sách quản lý gồm Coach hiện tại, gói đăng ký, tình trạng gói và ngày hết hạn; tất cả đều lấy từ dữ liệu phân công và membership hiện hành trong database.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Danh sách hội viên" } } }, post: { tags: ["Members"], summary: "Tạo hồ sơ hội viên", security: [{ sessionCookie: [] }], responses: { 201: { description: "Hồ sơ hội viên mới" } } } },
    "/members/{id}": { get: { tags: ["Members"], summary: "Chi tiết hội viên", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { 200: { description: "Hội viên" } } }, patch: { tags: ["Members"], summary: "Cập nhật hội viên", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã cập nhật" } } } },
    "/members/{id}/emergency-contacts": { put: { tags: ["Members"], summary: "Thay thế liên hệ khẩn cấp", description: "Tối đa ba liên hệ và chỉ một liên hệ chính; API dùng fullName, relationship, phone, isPrimary.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Danh sách liên hệ mới" }, 422: { description: "Có nhiều hơn một liên hệ chính hoặc dữ liệu không hợp lệ" } } } },
    "/staff": { get: { tags: ["Staff"], summary: "Danh sách nhân viên", security: [{ sessionCookie: [] }], responses: { 200: { description: "Danh sách nhân sự" }, 403: { description: "Thiếu quyền staff.manage" } } }, post: { tags: ["Staff"], summary: "Tạo nhân viên và gửi thông tin đăng nhập qua email", security: [{ sessionCookie: [] }], responses: { 201: { description: "Nhân viên mới; temporaryPassword chỉ trả về khi không gửi được email" } } } },
    "/staff/{id}": { get: { tags: ["Staff"], summary: "Chi tiết nhân viên", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { 200: { description: "Nhân viên" } } }, patch: { tags: ["Staff"], summary: "Cập nhật nhân viên", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã cập nhật" } } } },
    "/staff/{id}/status": { patch: { tags: ["Staff"], summary: "Đình chỉ hoặc kích hoạt nhân viên", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã cập nhật trạng thái" } } } },
    "/auth/register": {
      post: { tags: ["Auth"], summary: "Đăng ký hội viên công khai", description: "Khi CAPTCHA_ENABLED=true, captchaToken bắt buộc và được xác minh ở API bằng RECAPTCHA_SECRET_KEY.", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } } }, responses: { 201: { description: "Đã tạo tài khoản chờ xác thực" }, 409: { description: "Email hoặc số điện thoại đã tồn tại" }, 422: { description: "Dữ liệu hoặc CAPTCHA không hợp lệ" } } },
    },
    "/auth/verification/confirm": {
      post: { tags: ["Auth"], summary: "Xác thực email", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/VerificationRequest" } } } }, responses: { 200: { description: "Đã xác thực" }, 422: { description: "Mã không hợp lệ hoặc hết hạn" } } },
    },
    "/auth/verification/resend": { post: { tags: ["Auth"], summary: "Gửi lại mã xác thực", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/VerificationRecipient" } } } }, responses: { 200: { description: "Đã gửi mã" } } } },
    "/auth/login": { post: { tags: ["Auth"], summary: "Đăng nhập cổng vận hành", description: "Dành cho Manager, Lễ tân, Coach và Hội viên. Tài khoản Admin bị từ chối và phải dùng /auth/admin/login tại admin.kineticsports.io.vn. CAPTCHA được server xác minh khi bật; TOTP đã đăng ký trả challenge riêng cho cổng vận hành.", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } }, responses: { 200: { description: "Session cookie hoặc MFA challenge" }, 401: { description: "Sai thông tin đăng nhập" }, 403: { description: "Tài khoản Admin, tài khoản chưa hoạt động hoặc Origin không được phép" }, 422: { description: "CAPTCHA thiếu, sai hoặc hết hạn" }, 429: { description: "Đăng nhập sai vượt giới hạn, thử lại sau cửa sổ thời gian cấu hình" } } } },
    "/auth/admin/login": { post: { tags: ["Auth"], summary: "Đăng nhập cổng Admin riêng", description: "Chỉ chấp nhận role admin. Endpoint dùng bởi admin.kineticsports.io.vn; tài khoản các role khác bị từ chối. CAPTCHA được server xác minh khi bật và TOTP trả challenge chỉ có thể hoàn tất tại /auth/admin/mfa/totp/verify.", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } }, responses: { 200: { description: "Session cookie hoặc MFA challenge Admin" }, 401: { description: "Sai thông tin đăng nhập" }, 403: { description: "Không phải Admin, tài khoản chưa hoạt động hoặc Origin không được phép" }, 422: { description: "CAPTCHA thiếu, sai hoặc hết hạn" } } } },
    "/auth/mfa/totp/enrollment": { post: { tags: ["Auth"], summary: "Bắt đầu đăng ký Authenticator", description: "Mọi role đang có phiên đăng nhập đều có thể tự bật TOTP. Secret và otpauthUri chỉ xuất hiện trong phản hồi này; không ghi vào log hay audit value.", security: [{ sessionCookie: [] }], responses: { 201: { description: "Enrollment TOTP và otpauth URI" } } } },
    "/auth/mfa/totp/enrollment/confirm": { post: { tags: ["Auth"], summary: "Xác nhận Authenticator", description: "Mã 6 số phải hợp lệ trong enrollment chưa hết hạn. Secret được lưu mã hóa và enrollment chỉ dùng một lần.", security: [{ sessionCookie: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/TotpEnrollmentConfirmRequest" } } } }, responses: { 200: { description: "Đã kích hoạt TOTP" }, 422: { description: "Enrollment hết hạn hoặc mã không đúng" } } } },
    "/auth/mfa/totp/verify": { post: { tags: ["Auth"], summary: "Hoàn tất đăng nhập cổng vận hành bằng Authenticator", description: "Chỉ nhận challenge ID từ /auth/login. Challenge dùng một lần, hết hạn sau 5 phút; challenge Admin bị từ chối.", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/TotpLoginVerifyRequest" } } } }, responses: { 200: { description: "Đã tạo phiên" }, 403: { description: "Challenge thuộc cổng Admin" }, 422: { description: "Challenge hết hạn/đã dùng hoặc mã không đúng" } } } },
    "/auth/admin/mfa/totp/verify": { post: { tags: ["Auth"], summary: "Hoàn tất đăng nhập cổng Admin bằng Authenticator", description: "Chỉ nhận challenge ID từ /auth/admin/login. Challenge cổng vận hành bị từ chối.", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/TotpLoginVerifyRequest" } } } }, responses: { 200: { description: "Đã tạo phiên Admin" }, 403: { description: "Challenge thuộc cổng vận hành" }, 422: { description: "Challenge hết hạn/đã dùng hoặc mã không đúng" } } } },
    "/auth/logout": { post: { tags: ["Auth"], summary: "Đăng xuất", security: [{ sessionCookie: [] }], responses: { 200: { description: "Đã đăng xuất" }, 401: { description: "Chưa đăng nhập" } } } },
    "/auth/me": { get: { tags: ["Auth"], summary: "Lấy người dùng và quyền của phiên hiện tại", description: "user.mustChangePassword chặn chức năng trước khi đổi mật khẩu tạm; user.profileSetupRequired đưa tài khoản mới vào Hồ sơ. Hội viên tự đăng ký không phải đổi mật khẩu đã tự đặt.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Phiên hợp lệ" }, 401: { description: "Phiên không hợp lệ" } } } },
    "/auth/registrations/pending": { get: { tags: ["Auth"], summary: "Danh sách đăng ký chờ duyệt", description: "Admin và Lễ tân có quyền registration.approve; Manager không có quyền này.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Danh sách chờ duyệt" }, 403: { description: "Thiếu quyền registration.approve" } } } },
    "/auth/registrations/{userId}/approve": { post: { tags: ["Auth"], summary: "Admin hoặc Lễ tân duyệt tài khoản hội viên", security: [{ sessionCookie: [] }], parameters: [{ name: "userId", in: "path", required: true, schema: uuid }], responses: { 200: { description: "Tài khoản đã kích hoạt" }, 403: { description: "Thiếu quyền registration.approve" } } } },
    "/auth/password/change": { post: { tags: ["Auth"], summary: "Đổi mật khẩu", description: "Cho phép đổi mật khẩu tạm ở lần đăng nhập đầu; giữ phiên hiện tại và thu hồi các phiên khác. user.mustChangePassword trở thành false.", security: [{ sessionCookie: [] }], requestBody: jsonBody({ type: "object", required: ["currentPassword", "newPassword"], properties: { currentPassword: { type: "string", format: "password" }, newPassword: { type: "string", format: "password", minLength: 8, maxLength: 72, description: "Cần chữ hoa, chữ thường và chữ số." } } }), responses: { 200: { description: "Đã đổi mật khẩu" }, 401: { description: "Chưa đăng nhập" }, 422: { description: "Mật khẩu hiện tại hoặc mật khẩu mới không hợp lệ" } } } },
    "/auth/mfa/email/verify": { post: { tags: ["Auth"], summary: "Hoàn tất đăng nhập nhân viên bằng OTP email", description: "Chỉ chấp nhận challenge staff_login còn hạn của Coach/Lễ tân. Mã chỉ sử dụng một lần.", requestBody: jsonBody({ $ref: "#/components/schemas/TotpLoginVerifyRequest" }), responses: { 200: { description: "Session cookie và quyền của nhân viên" }, 401: { description: "Tài khoản không hoạt động hoặc không đúng role" }, 422: { description: "Challenge hoặc mã không hợp lệ" } } } },
    "/members/me/payments/{id}": { get: { tags: ["Payments"], summary: "Hội viên xem biên lai của chính mình", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: uuid }], responses: { 200: { description: "Biên lai giao dịch thuộc hội viên" }, 403: { description: "Biên lai ngoài phạm vi tài khoản" }, 404: { description: "Không tìm thấy giao dịch" } } } },
    "/training-plans/{id}/sessions": { get: { tags: ["Training"], summary: "Danh sách buổi tập của giáo án", description: "Yêu cầu quyền training.write và áp dụng scope Coach nếu là Coach.", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: uuid }], responses: { 200: { description: "Các buổi tập và bài tập" }, 403: { description: "Ngoài phạm vi Coach" } } }, post: { tags: ["Training"], summary: "Tạo buổi tập cho giáo án", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: uuid }], requestBody: jsonBody({ $ref: "#/components/schemas/TrainingSessionRequest" }), responses: { 201: { description: "Buổi tập mới" }, 403: { description: "Thiếu quyền training.write hoặc ngoài phạm vi Coach" } } } },
    "/training-plans/{id}/sessions/order": { put: { tags: ["Training"], summary: "Sắp thứ tự các buổi tập", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: uuid }], requestBody: jsonBody({ $ref: "#/components/schemas/UuidOrderRequest" }), responses: { 200: { description: "Đã sắp thứ tự" }, 403: { description: "Thiếu quyền training.write hoặc ngoài phạm vi Coach" } } } },
    "/training-sessions/{id}/exercises/order": { put: { tags: ["Training"], summary: "Sắp thứ tự bài tập trong buổi", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: uuid }], requestBody: jsonBody({ $ref: "#/components/schemas/UuidOrderRequest" }), responses: { 200: { description: "Đã sắp thứ tự" }, 403: { description: "Thiếu quyền training.write hoặc ngoài phạm vi Coach" } } } },
    "/training-sessions/{id}": { patch: { tags: ["Training"], summary: "Cập nhật trạng thái buổi tập", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: uuid }], requestBody: jsonBody({ type: "object", required: ["status"], properties: { status: { type: "string", enum: ["pending", "completed", "skipped"] }, coachComment: { type: "string", maxLength: 500 } } }), responses: { 200: { description: "Buổi tập đã cập nhật" }, 403: { description: "Thiếu quyền training.write hoặc ngoài phạm vi Coach" } } } },
    "/members/{id}/training-results": { get: { tags: ["Training"], summary: "Kết quả tập của hội viên", description: "Yêu cầu quyền training.write; Coach chỉ xem hội viên trong phạm vi.", security: [{ sessionCookie: [] }], parameters: [{ name: "id", in: "path", required: true, schema: uuid }], responses: { 200: { description: "Kết quả tập" }, 403: { description: "Ngoài phạm vi Coach" } } } },
    "/admin/permissions/matrix": { get: { tags: ["Role permissions"], summary: "Admin xem bảng quyền của bốn vai trò nghiệp vụ", description: "Trả danh mục permission, nhóm hiển thị và danh sách quyền được chọn cùng version của Manager, Lễ tân, Coach, Hội viên. Admin luôn toàn quyền và không phải một cột có thể chỉnh sửa.", security: [{ sessionCookie: [] }], responses: { 200: { description: "Bảng quyền", content: { "application/json": { schema: { $ref: "#/components/schemas/RolePermissionMatrixResponse" } } } }, 401: { description: "Chưa đăng nhập" }, 403: { description: "Chỉ Admin được xem bảng quyền" } } } },
    "/admin/roles/{role}/permissions": { put: { tags: ["Role permissions"], summary: "Admin thay toàn bộ quyền của một vai trò", description: "Chỉ bốn vai trò nghiệp vụ được cấu hình. permissionCodes có thể rỗng. version chống ghi đè khi Admin khác đã lưu; cập nhật quyền và audit trong một transaction. Thu hồi quyền có hiệu lực ở request BE tiếp theo.", security: [{ sessionCookie: [] }], parameters: [{ name: "role", in: "path", required: true, schema: { type: "string", enum: ["manager", "receptionist", "coach", "member"] } }], requestBody: jsonBody({ type: "object", additionalProperties: false, required: ["version", "permissionCodes"], properties: { version: { type: "integer", minimum: 0 }, permissionCodes: { type: "array", uniqueItems: true, items: { type: "string", maxLength: 150 } } } }), responses: { 200: { description: "Quyền đã lưu cùng version mới", content: { "application/json": { schema: { $ref: "#/components/schemas/RolePermissionUpdateResponse" } } } }, 401: { description: "Chưa đăng nhập" }, 403: { description: "Chỉ Admin được thay đổi quyền" }, 404: { description: "Role không tồn tại" }, 409: { description: "Version đã cũ; tải lại bảng trước khi lưu" }, 422: { description: "Role hoặc permission không hợp lệ, hoặc permission bị trùng" } } } },
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
      RegisterRequest: { type: "object", required: ["fullName", "email", "phone", "password"], properties: { fullName: { type: "string", example: "Nguyễn Minh Anh" }, email: { type: "string", format: "email" }, phone: { type: "string", example: "0901234567" }, password: { type: "string", format: "password", minLength: 8 }, captchaToken: { type: "string", description: "Bắt buộc khi CAPTCHA_ENABLED=true" } } },
      VerificationRecipient: { type: "object", required: ["userId", "channel"], properties: { userId: { type: "string", format: "uuid" }, channel: { type: "string", enum: ["email"] } } },
      VerificationRequest: { allOf: [{ $ref: "#/components/schemas/VerificationRecipient" }, { type: "object", required: ["code"], properties: { code: { type: "string", example: "123456" } } }] },
      LoginRequest: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password" }, captchaToken: { type: "string", description: "Bắt buộc khi CAPTCHA_ENABLED=true" } } },
      TotpEnrollmentConfirmRequest: { type: "object", required: ["enrollmentId", "code"], properties: { enrollmentId: { type: "string", format: "uuid" }, code: { type: "string", pattern: "^\\d{6}$", example: "123456" } } },
      TotpLoginVerifyRequest: { type: "object", required: ["challengeId", "code"], properties: { challengeId: { type: "string", format: "uuid" }, code: { type: "string", pattern: "^\\d{6}$", example: "123456" } } },
      UuidOrderRequest: { type: "object", required: ["ids"], properties: { ids: { type: "array", minItems: 1, items: uuid } } },
      TrainingExerciseRequest: { type: "object", required: ["name", "sets", "rest_seconds"], properties: { name: { type: "string", minLength: 1, maxLength: 100 }, sets: { type: "integer", minimum: 1 }, reps: { type: ["integer", "null"], minimum: 1 }, duration_seconds: { type: ["integer", "null"], minimum: 1 }, rest_seconds: { type: "integer", minimum: 0 }, instructions: { type: "string", maxLength: 500 } } },
      TrainingSessionRequest: { type: "object", required: ["position", "title", "exercises"], properties: { position: { type: "integer", minimum: 1 }, title: { type: "string", minLength: 2, maxLength: 200 }, scheduledOn: { type: "string", format: "date" }, exercises: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/TrainingExerciseRequest" } } } },
      AuthUser: { type: "object", required: ["id", "email", "displayName", "role", "status", "mustChangePassword", "profileSetupRequired"], properties: { id: uuid, email: { type: "string", format: "email" }, displayName: { type: "string" }, role: { type: "string", enum: ["admin", "manager", "receptionist", "coach", "member"] }, status: { type: "string" }, mustChangePassword: { type: "boolean" }, profileSetupRequired: { type: "boolean" } } },
      CurrentSessionResponse: { type: "object", required: ["success", "data"], properties: { success: { type: "boolean" }, data: { type: "object", required: ["user", "permissions"], properties: { user: { $ref: "#/components/schemas/AuthUser" }, permissions: { type: "array", items: { type: "string" } } } } } },
      RolePermissionMatrixResponse: { type: "object", required: ["success", "data"], properties: { success: { type: "boolean" }, data: { type: "object", required: ["permissions", "roles"], properties: { permissions: { type: "array", items: { type: "object", required: ["code", "description", "group", "requires", "availableRoles"], properties: { code: { type: "string" }, description: { type: "string" }, group: { type: "string" }, requires: { type: "array", items: { type: "string" } }, availableRoles: { type: "array", items: { type: "string", enum: ["manager", "receptionist", "coach", "member"] } } } } }, roles: { type: "array", minItems: 4, maxItems: 4, items: { type: "object", required: ["code", "label", "version", "permissionCodes"], properties: { code: { type: "string", enum: ["manager", "receptionist", "coach", "member"] }, label: { type: "string" }, version: { type: "integer", minimum: 0 }, permissionCodes: { type: "array", items: { type: "string" } } } } } } } } },
      RolePermissionUpdateResponse: { type: "object", required: ["success", "data"], properties: { success: { type: "boolean" }, data: { type: "object", required: ["kind", "role", "version", "permissionCodes"], properties: { kind: { type: "string", enum: ["updated"] }, role: { type: "string", enum: ["manager", "receptionist", "coach", "member"] }, version: { type: "integer", minimum: 1 }, permissionCodes: { type: "array", items: { type: "string" } } } } } },
    },
  },
};

openApiSpec.paths["/auth/me"].get.responses[200].content = { "application/json": { schema: { $ref: "#/components/schemas/CurrentSessionResponse" } } };
for (const method of ["get", "patch"]) {
  openApiSpec.paths["/auth/profile"][method].responses[200].content = {
    "application/json": { schema: { type: "object", required: ["success", "data"], properties: { success: { type: "boolean" }, data: { type: "object", required: ["id", "role", "profileSetupRequired"], properties: { id: uuid, role: { type: "string", enum: ["admin", "manager", "receptionist", "coach", "member"] }, profileSetupRequired: { type: "boolean" } } } } } },
  };
}
openApiSpec.paths["/health"].get.servers = [{ url: "/" }];
openApiSpec.paths["/classes/{id}/change-requests"].post.responses[201].description = "Yêu cầu chờ Admin hoặc Lễ tân duyệt";
openApiSpec.paths["/memberships/{id}/freeze-requests"].post.description = "Yêu cầu quyền membership.freeze.request. Hội viên chỉ có thể yêu cầu cho gói đang hoạt động của chính mình; sau khi Admin hoặc Lễ tân duyệt, hệ thống cộng bù đúng số ngày đóng băng.";
openApiSpec.paths["/memberships/{id}/freeze-requests"].post.responses[201].description = "Yêu cầu chờ Admin hoặc Lễ tân duyệt";

const permissionContracts = [
  ["/membership-packages", "get", "membership.package.read"],
  ["/members/me/memberships", "get", "membership.self.read"],
  ["/members/me/attendance", "get", "attendance.self.read"],
  ["/members/me/payments", "get", "payment.self.read"],
  ["/members/me/payments/{id}", "get", "payment.self.read"],
  ["/members/me/training", "get", "training.self.read"],
  ["/notification-preferences", "get", "notification.preference.manage"],
  ["/notification-preferences", "put", "notification.preference.manage"],
  ["/support-tickets", "get", "support.ticket.read"],
  ["/support-tickets", "post", "support.ticket.create"],
  ["/support-tickets/{id}", "get", "support.ticket.read"],
  ["/support-tickets/{id}/assign-self", "post", "support.ticket.respond"],
  ["/support-tickets/{id}/responses", "post", "support.ticket.respond"],
  ["/ai-assist/suggestions", "get", "ai.assist.read"],
  ["/ai-assist/deliveries", "post", "ai.assist.deliver"],
  ["/classes/{id}/change-requests", "post", "class.change.request"],
];
for (const [path, method, permission] of permissionContracts) {
  const operation = openApiSpec.paths[path][method];
  operation["x-required-permission"] = permission;
  operation.description = `${operation.description ? `${operation.description} ` : ""}Yêu cầu quyền ${permission}; phạm vi dữ liệu của hội viên/Coach vẫn được kiểm tra riêng.`;
  operation.responses[403] ??= { description: `Thiếu quyền ${permission} hoặc ngoài phạm vi dữ liệu` };
}
openApiSpec.paths["/ai-assist/suggestions"].get.summary = "Xem bản nháp gợi ý AI theo quyền được cấp";
openApiSpec.paths["/ai-assist/suggestions"].get.description = "Yêu cầu quyền ai.assist.read. Gợi ý dựa trên phạm vi vận hành của tài khoản; đây không phải chatbot hay tư vấn y khoa.";
openApiSpec.paths["/ai-assist/suggestions"].get.responses[403].description = "Thiếu quyền ai.assist.read";
openApiSpec.paths["/ai-assist/deliveries"].post.summary = "Rà soát và gửi hướng dẫn AI theo quyền được cấp";
openApiSpec.paths["/ai-assist/deliveries"].post.description = "Yêu cầu quyền ai.assist.deliver. Coach chỉ gửi cho hội viên trong phạm vi phân công; người dùng khác được cấp quyền có thể gửi cho hội viên hợp lệ.";
openApiSpec.paths["/ai-assist/deliveries"].post.responses[403].description = "Thiếu quyền ai.assist.deliver hoặc hội viên ngoài phạm vi Coach";
openApiSpec.paths["/support-tickets/{id}/assign-self"].post.summary = "Người có quyền xử lý nhận phụ trách ticket";
openApiSpec.paths["/support-tickets/{id}/assign-self"].post.responses[403].description = "Thiếu quyền support.ticket.respond hoặc ngoài phạm vi ticket";
openApiSpec.paths["/support-tickets/{id}/responses"].post.responses[403].description = "Thiếu quyền support.ticket.respond hoặc ngoài phạm vi ticket";
openApiSpec.paths["/support-tickets"].get.description = "Yêu cầu quyền support.ticket.read. Hội viên chỉ xem ticket của chính mình; các vai trò khác xem hàng chờ vận hành khi được cấp quyền.";
openApiSpec.paths["/support-tickets/{id}/responses"].post.description = "Yêu cầu quyền support.ticket.respond. Phản hồi tạo thông báo cho chủ ticket; hội viên chỉ thao tác trong ticket của chính mình.";
openApiSpec.paths["/classes/{id}/change-requests"].post.description = "Yêu cầu quyền class.change.request. Coach chỉ đề xuất cho lớp mình phụ trách; vai trò khác được cấp quyền có thể đề xuất cho lớp đang công bố.";
openApiSpec.paths["/admin/roles/{role}/permissions"].put.description += " Các quyền có requires phải được cấp kèm quyền phụ thuộc; quyền tự phục vụ cần hồ sơ hội viên nên chỉ áp dụng cho Member. Danh mục quyền chỉ gồm các API hiện được thực thi.";
const permissionItemSchema = openApiSpec.components.schemas.RolePermissionMatrixResponse.properties.data.properties.permissions.items;
permissionItemSchema.required.push("requiresByRole");
permissionItemSchema.properties.requiresByRole = {
  type: "object",
  description: "Quyền phụ thuộc riêng từng vai trò; ví dụ nhân viên cần member.read để tạo booking cho hội viên.",
  additionalProperties: { type: "array", items: { type: "string" } },
};

const permissionDescriptions = [
  ["/auth/registrations/pending", "get", "registration.approve", "Người được cấp quyền xem danh sách đăng ký chờ duyệt."],
  ["/auth/registrations/{userId}/approve", "post", "registration.approve", "Người được cấp quyền duyệt tài khoản hội viên."],
  ["/classes/{id}/change-requests", "post", "class.change.request", "Người được cấp quyền đề xuất đổi lớp; Coach chỉ thao tác lớp mình phụ trách."],
  ["/class-change-requests", "get", "class.change.review", "Người được cấp quyền xem yêu cầu đổi lớp."],
  ["/class-change-requests/{id}", "patch", "class.change.review", "Người được cấp quyền duyệt hoặc từ chối yêu cầu đổi lớp."],
  ["/membership-freeze-requests/{id}", "patch", "membership.freeze.review", "Người được cấp quyền duyệt hoặc từ chối yêu cầu đóng băng."],
  ["/memberships/{id}/cancel-pending-renewal", "patch", "membership.assign", "Người được cấp quyền hủy gia hạn chờ thanh toán."],
  ["/members/{id}/memberships", "post", "membership.assign", "Người được cấp quyền tạo gói chờ thanh toán cho hội viên."],
];
for (const [path, method, permission, summary] of permissionDescriptions) {
  const operation = openApiSpec.paths[path][method];
  operation.summary = summary;
  operation["x-required-permission"] = permission;
  operation.responses[403] = { description: `Thiếu quyền ${permission} hoặc ngoài phạm vi dữ liệu` };
}
openApiSpec.paths["/auth/registrations/pending"].get.description = "Yêu cầu quyền registration.approve; Admin luôn có mọi quyền.";
openApiSpec.paths["/memberships/{id}/freeze-requests"].post.description = "Yêu cầu quyền membership.freeze.request và hồ sơ Hội viên. Chỉ được đề xuất đóng băng gói của chính mình.";
openApiSpec.paths["/payments"].get.description = "Yêu cầu quyền payment.read; quyền lập phiếu thu được cấu hình riêng bằng payment.record.";
openApiSpec.paths["/payments"].get.responses[200].description = "Phiếu thu kèm hội viên và gói đã gắn; giao dịch VNPAY lịch sử vẫn có provider=vnpay từ legacy_provider, nhưng không thể tạo VNPAY mới.";
openApiSpec.paths["/members/me/payments"].get.responses[200].description = "Lịch sử giao dịch read-only, gồm nhãn nhà cung cấp VNPAY cũ nếu có.";
openApiSpec.paths["/members/me/payments/{id}"].get.responses[200].description = "Biên lai giao dịch thuộc hội viên; VNPAY lịch sử được giữ nhãn qua legacy_provider.";
openApiSpec.paths["/payments"].post.summary = "Người có quyền lập phiếu thu hoặc link PayOS";
openApiSpec.paths["/payments"].post["x-required-permission"] = "payment.record";
openApiSpec.paths["/payments/{id}/confirm"].post.summary = "Người có quyền xác nhận tiền mặt/chuyển khoản";
openApiSpec.paths["/payments/{id}/confirm"].post["x-required-permission"] = "payment.record";
openApiSpec.paths["/bookings"].get.description = "Yêu cầu quyền booking.read. Hội viên chỉ xem lịch của mình; Coach chỉ xem lớp mình phụ trách; các vai trò khác được cấp quyền xem lịch vận hành.";
openApiSpec.paths["/bookings"].post.description = "Yêu cầu quyền booking.write. Hội viên chỉ đặt cho mình; các vai trò khác được cấp quyền có thể đặt cho hội viên và cần thêm quyền member.read để chọn hội viên. Gói và waitlist vẫn được kiểm tra.";
openApiSpec.paths["/bookings"].post.requestBody.content["application/json"].schema.properties.memberId.description = "Bắt buộc khi người không phải Hội viên đặt thay hội viên.";
openApiSpec.paths["/bookings/{id}/cancel"].patch.description = "Yêu cầu quyền booking.write. Hội viên chỉ hủy booking của mình trước giờ học ít nhất 5 tiếng; người được cấp quyền ở vai trò khác có thể hủy cho hội viên.";
openApiSpec.paths["/bookings"].post["x-required-permission"] = "booking.write";
openApiSpec.paths["/bookings/{id}/cancel"].patch["x-required-permission"] = "booking.write";

// Keep request bodies and path parameters explicit for Swagger UI's Try it out.
const staffFields = {
  fullName: { type: "string", minLength: 2, maxLength: 120 },
  email: { type: "string", format: "email" },
  phone: { type: "string", minLength: 9, maxLength: 20 },
  dateOfBirth: { type: ["string", "null"], format: "date" },
  notes: { type: ["string", "null"], maxLength: 1000 },
  role: { type: "string", enum: ["manager", "receptionist", "coach"] },
  specialties: { type: "array", maxItems: 12, items: { type: "string", minLength: 1, maxLength: 60 } },
};
const memberFields = {
  fullName: { type: "string", minLength: 2, maxLength: 120 },
  email: { type: ["string", "null"], format: "email" },
  phone: { type: "string", minLength: 9, maxLength: 20 },
  dateOfBirth: { type: ["string", "null"], format: "date" },
  gender: { type: ["string", "null"], maxLength: 30 },
};
const contact = { type: "object", required: ["fullName", "relationship", "phone"], properties: { fullName: { type: "string", minLength: 2, maxLength: 120 }, relationship: { type: "string", minLength: 2, maxLength: 60 }, phone: { type: "string", minLength: 9, maxLength: 20 }, isPrimary: { type: "boolean", default: false } } };
const classFields = { name: { type: "string", minLength: 2, maxLength: 120 }, type: { type: "string", minLength: 2, maxLength: 60 }, description: { type: "string", maxLength: 1000 }, coachUserId: uuid, roomId: uuid, startsAt: { type: "string", format: "date-time" }, endsAt: { type: "string", format: "date-time" }, capacity: { type: "integer", minimum: 1, maximum: 500 } };
const entitlement = { type: "object", required: ["code"], properties: { code: { type: "string", enum: ["gym_access", "group_class_booking", "pool_access", "sauna_access", "towel_service", "premium_locker", "pt_session"] }, usageLimit: { type: ["integer", "null"], minimum: 1 }, limitPeriod: { type: ["string", "null"], enum: ["weekly", "monthly", null] } } };
const packageFields = { code: { type: "string", minLength: 2, maxLength: 30, pattern: "^[A-Z0-9_-]+$" }, name: { type: "string", minLength: 2, maxLength: 100 }, priceVnd: { type: "integer", minimum: 0 }, durationDays: { type: "integer", minimum: 1, maximum: 730 }, tierRank: { type: "integer", minimum: 1 }, benefits: { type: "array", maxItems: 20, items: { type: "string", minLength: 1, maxLength: 200 } }, entitlements: { type: "array", maxItems: 20, items: entitlement }, isActive: { type: "boolean" } };
const exercise = { $ref: "#/components/schemas/TrainingExerciseRequest" };
const bodyContracts = [
  ["/training-templates", "post", { type: "object", required: ["name", "targetGroup", "exercises"], properties: { name: { type: "string", minLength: 2 }, targetGroup: { type: "string", minLength: 2 }, description: { type: "string", maxLength: 500 }, exercises: { type: "array", minItems: 1, items: exercise } } }],
  ["/training-plans", "post", { type: "object", required: ["memberId", "name", "goal", "startsOn", "endsOn"], properties: { memberId: uuid, templateId: uuid, name: { type: "string", minLength: 2 }, goal: { type: "string", minLength: 2 }, startsOn: { type: "string", format: "date" }, endsOn: { type: "string", format: "date" }, exercises: { type: "array", items: exercise } } }],
  ["/training-plans/{id}", "patch", { type: "object", properties: { name: { type: "string", minLength: 2 }, goal: { type: "string", minLength: 2 }, status: { type: "string", minLength: 2 }, exercises: { type: "array", items: exercise } } }],
  ["/training-results", "post", { type: "object", required: ["planId", "recordedOn", "metric"], properties: { planId: uuid, exerciseId: uuid, recordedOn: { type: "string", format: "date" }, metric: { type: "string", minLength: 1 }, valueNumeric: { type: "number" }, valueText: { type: "string", maxLength: 500 }, coachComment: { type: "string", maxLength: 500 } } }],
  ["/payments", "post", { type: "object", required: ["memberId", "amountVnd"], additionalProperties: false, properties: { memberId: uuid, membershipId: uuid, amountVnd: { type: "integer", minimum: 1 }, method: { type: "string", enum: ["cash", "bank_transfer", "online"] }, provider: { type: "string", enum: ["payos"], description: "Bắt buộc khi method=online; không được truyền với các phương thức khác." }, notes: { type: "string", maxLength: 500 } } }],
  ["/payments/{id}/confirm", "post", { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["paid", "failed"] }, reconciliationNote: { type: "string", minLength: 10, maxLength: 500, description: "Bắt buộc khi xác nhận chuyển khoản paid." } } }],
  ["/classes/{id}/attendance/submit", "post", { type: "object", required: ["entries"], properties: { entries: { type: "array", minItems: 1, items: { type: "object", required: ["bookingId", "status"], properties: { bookingId: uuid, status: { type: "string", enum: ["present", "absent", "late"] } } } } } }],
  ["/attendance/check-in", "post", { type: "object", required: ["bookingId"], properties: { bookingId: uuid } }],
  ["/attendance/{id}/corrections", "post", { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["present", "absent", "late", "not_marked"] }, reason: { type: "string", minLength: 3, maxLength: 500, description: "Bắt buộc sau giờ học." } } }],
  ["/classes", "post", { type: "object", required: ["name", "type", "coachUserId", "roomId", "startsAt", "endsAt", "capacity"], properties: classFields }],
  ["/classes/{id}", "patch", { type: "object", properties: classFields }],
  ["/classes/{id}/change-requests", "post", { type: "object", required: ["type", "reason"], properties: { type: { type: "string", enum: ["cancel", "reschedule"] }, startsAt: { type: "string", format: "date-time", description: "Bắt buộc khi type=reschedule." }, endsAt: { type: "string", format: "date-time", description: "Bắt buộc khi type=reschedule." }, reason: { type: "string", minLength: 3, maxLength: 500 } } }],
  ["/class-change-requests/{id}", "patch", { type: "object", required: ["approved"], properties: { approved: { type: "boolean" } } }],
  ["/membership-packages", "post", { type: "object", required: ["code", "name", "priceVnd", "durationDays", "tierRank"], properties: packageFields }],
  ["/membership-packages/{id}", "patch", { type: "object", properties: Object.fromEntries(Object.entries(packageFields).filter(([name]) => name !== "code")) }],
  ["/membership-freeze-requests/{id}", "patch", { type: "object", required: ["approved"], properties: { approved: { type: "boolean" } } }],
  ["/members/{id}/memberships", "post", { type: "object", required: ["packageId", "startsOn"], properties: { packageId: uuid, startsOn: { type: "string", format: "date" } } }],
  ["/members", "post", { type: "object", required: ["fullName", "phone"], properties: { ...memberFields, contacts: { type: "array", maxItems: 3, items: contact } } }],
  ["/members/{id}", "patch", { type: "object", properties: memberFields }],
  ["/members/{id}/emergency-contacts", "put", { type: "object", required: ["contacts"], properties: { contacts: { type: "array", maxItems: 3, items: contact } } }],
  ["/staff", "post", { type: "object", required: ["fullName", "email", "phone", "role"], properties: staffFields }],
  ["/staff/{id}", "patch", { type: "object", properties: staffFields }],
  ["/staff/{id}/status", "patch", { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["active", "suspended"] } } }],
];

for (const [path, method, schema] of bodyContracts) {
  openApiSpec.paths[path][method].requestBody = jsonBody(schema);
}

for (const [path, operations] of Object.entries(openApiSpec.paths)) {
  const names = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  for (const method of ["get", "post", "patch", "put", "delete"]) {
    const operation = operations[method];
    if (!operation) continue;
    const parameters = operation.parameters ?? [];
    for (const name of names) {
      if (!parameters.some((parameter) => parameter.in === "path" && parameter.name === name)) {
        parameters.push({ name, in: "path", required: true, schema: name === "role" ? { type: "string", enum: ["admin", "manager", "receptionist", "coach", "member"] } : uuid });
      }
    }
    if (parameters.length) operation.parameters = parameters;
  }
}
