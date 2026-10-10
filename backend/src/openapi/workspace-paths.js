import { jsonBody } from "./contract-helpers.js";

export const workspacePaths = {
  "/audit-logs": {
    get: {
      tags: ["Audit"],
      summary: "Nhật ký kiểm toán (lọc lịch sử theo đối tượng)",
      security: [{ sessionCookie: [] }],
      parameters: [
        {
          name: "entityType",
          in: "query",
          description: "Loại đối tượng; phải đi cùng entityId",
          schema: { type: "string", pattern: "^[a-z][a-z_]{0,63}$" },
        },
        {
          name: "entityId",
          in: "query",
          description: "UUID đối tượng; phải đi cùng entityType",
          schema: { type: "string", format: "uuid" },
        },
        { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
        { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
      ],
      responses: {
        200: {
          description:
            "Danh sách phân trang, bao gồm actor.id, actor.name và pagination { page, pageSize, total, totalPages }",
        },
      },
    },
  },
  "/dashboards/{role}": {
    get: {
      tags: ["Dashboard"],
      summary: "Tổng quan và so sánh vận hành theo vai trò",
      description:
        "role phải khớp đúng role của phiên đăng nhập. Admin và Manager có thể lọc day, week, month, quarter hoặc year; mọi KPI so sánh với kỳ liền trước có cùng độ dài. Doanh thu chỉ cộng phiếu thu tiền mặt đã xác nhận theo paid_at. Các vai trò khác chỉ nhận dữ liệu trong phạm vi của họ. Lễ tân: pendingPayments đếm phiếu pending với method=cash. Hội viên: pendingPayments đếm phiếu pending của hội viên, không đếm đăng ký gói. Coach: assignedClasses đếm toàn bộ lớp không phải buổi PT do Coach phụ trách; trainingPlans đếm mọi giáo án của hội viên thuộc phạm vi phân công, booking và PT còn hiệu lực, kể cả giáo án đã hoàn thành.",
      security: [{ sessionCookie: [] }],
      parameters: [
        {
          name: "period",
          in: "query",
          schema: { type: "string", enum: ["day", "week", "month", "quarter", "year", "custom"], default: "day" },
        },
        { name: "from", in: "query", schema: { type: "string", format: "date" } },
        { name: "to", in: "query", schema: { type: "string", format: "date" } },
      ],
      responses: {
        200: { description: "KPI, biến động so với kỳ trước, xu hướng doanh thu và cảnh báo theo phạm vi quyền" },
        403: { description: "Không được xem dashboard của role khác" },
      },
    },
  },
  "/notifications": {
    get: {
      tags: ["Notifications"],
      summary: "Thông báo trong hệ thống",
      description:
        "Bao gồm thông báo vòng đời gói tập, booking, điểm danh, thanh toán và hỗ trợ. Mỗi tài khoản nhận thông báo thao tác thay đổi thành công của chính mình; admin nhận bản tổng hợp từ các API đã xác thực, lưu created_at và read_at; các thông báo vận hành này chỉ gửi trong ứng dụng. Riêng điểm danh chỉ thông báo một lần khi chốt cả lớp, không thông báo thao tác từng học viên hoặc lần chốt lặp lại. Email chỉ gửi các sự kiện quan trọng về tài chính, quyền sử dụng gói, lịch/đặt chỗ và phản hồi hỗ trợ khi người nhận bật email. Thông báo cập nhật thường được đánh dấu bỏ qua email, vẫn giữ trong chuông. Email worker dùng claim/retry giới hạn để tránh gửi trùng.",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Thông báo của tài khoản đăng nhập" } },
    },
  },
  "/notifications/{id}/read": {
    patch: {
      tags: ["Notifications"],
      summary: "Đánh dấu đã đọc",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "Đã đọc" } },
    },
  },
  "/notification-preferences": {
    get: {
      tags: ["Notifications"],
      summary: "Xem tùy chọn nhận email",
      security: [{ sessionCookie: [] }],
      responses: { 200: { description: "email_enabled của tài khoản hiện tại" } },
    },
    put: {
      tags: ["Notifications"],
      summary: "Cập nhật tùy chọn nhận email",
      security: [{ sessionCookie: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { type: "object", required: ["emailEnabled"], properties: { emailEnabled: { type: "boolean" } } },
          },
        },
      },
      responses: { 200: { description: "Tùy chọn đã lưu" }, 422: { description: "emailEnabled phải là boolean" } },
    },
  },
  "/support-tickets": {
    get: {
      tags: ["Support"],
      summary: "Danh sách yêu cầu hỗ trợ theo phạm vi",
      description: "Hội viên chỉ nhận ticket của mình; Admin, Manager và Lễ tân nhận hàng chờ vận hành.",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Danh sách ticket" },
        403: { description: "Vai trò không được xử lý hỗ trợ" },
      },
    },
    post: {
      tags: ["Support"],
      summary: "Hội viên tạo yêu cầu hỗ trợ",
      security: [{ sessionCookie: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["subject", "body"],
              properties: {
                subject: { type: "string", minLength: 3, maxLength: 200 },
                body: { type: "string", minLength: 3, maxLength: 5000 },
                priority: { type: "string", enum: ["low", "normal", "high"] },
              },
            },
          },
        },
      },
      responses: { 201: { description: "Ticket đã tạo" } },
    },
  },
  "/support-tickets/{id}": {
    get: {
      tags: ["Support"],
      summary: "Xem chi tiết ticket và phản hồi",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { 200: { description: "Ticket và lịch sử phản hồi" }, 403: { description: "Ngoài phạm vi ticket" } },
    },
  },
  "/support-tickets/{id}/assign-self": {
    post: {
      tags: ["Support"],
      summary: "Admin, Manager hoặc Lễ tân nhận phụ trách ticket",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Ticket chuyển sang in_progress" },
        403: { description: "Chỉ Admin, Manager hoặc Lễ tân" },
      },
    },
  },
  "/support-tickets/{id}/responses": {
    post: {
      tags: ["Support"],
      summary: "Phản hồi ticket và tạo thông báo cho hội viên",
      description:
        "Phản hồi của Admin, Manager hoặc Lễ tân tạo notification cho chủ ticket; email worker chỉ gửi nếu hội viên đang bật email.",
      security: [{ sessionCookie: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["body"],
              properties: {
                body: { type: "string", minLength: 1, maxLength: 5000 },
                status: { type: "string", enum: ["open", "in_progress", "resolved", "closed"] },
              },
            },
          },
        },
      },
      responses: {
        200: { description: "Phản hồi và thông báo đã tạo" },
        403: { description: "Chỉ Admin, Manager hoặc Lễ tân" },
      },
    },
  },
  "/reports/revenue": {
    get: {
      tags: ["Reports"],
      summary: "Doanh thu và trạng thái phiếu thu",
      description:
        "Doanh thu chỉ cộng payment paid theo paid_at. byService phân tách membership, khóa, PT, thuê sân/phòng và khoản khác, kèm số giao dịch cần đối soát cấp quyền. createdSummary và paymentStatuses phản ánh giao dịch được tạo trong khoảng lọc; trend trả thực thu theo từng ngày nghiệp vụ Asia/Ho_Chi_Minh (UTC+07:00). Các kỳ và khoảng from/to đều dùng ngày Việt Nam. Yêu cầu quyền report.read.",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Thực thu, giá trị giao dịch, phần chờ xác nhận, tỷ lệ hoàn tất và xu hướng theo ngày" },
        403: { description: "Thiếu quyền report.read" },
      },
    },
  },
  "/reports/attendance": {
    get: {
      tags: ["Reports"],
      summary: "Báo cáo điểm danh",
      description:
        "Trả đủ trạng thái, tổng lượt, tỷ lệ tham gia và xu hướng theo ngày nghiệp vụ Asia/Ho_Chi_Minh (UTC+07:00) trong khoảng lọc. Yêu cầu quyền report.read.",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Tổng hợp và xu hướng điểm danh" },
        403: { description: "Thiếu quyền report.read" },
      },
    },
  },
  "/reports/{type}/export": {
    get: {
      tags: ["Reports"],
      summary: "Xuất báo cáo CSV",
      description:
        "Xuất báo cáo doanh thu hoặc điểm danh theo các bộ lọc giống API báo cáo; ngày lọc và tên tệp dùng Asia/Ho_Chi_Minh (UTC+07:00). Yêu cầu quyền report.read.",
      security: [{ sessionCookie: [] }],
      parameters: [
        { name: "type", in: "path", required: true, schema: { type: "string", enum: ["revenue", "attendance"] } },
        {
          name: "period",
          in: "query",
          schema: { type: "string", enum: ["day", "week", "month", "quarter", "year", "custom"], default: "day" },
        },
        { name: "from", in: "query", schema: { type: "string", format: "date" } },
        { name: "to", in: "query", schema: { type: "string", format: "date" } },
        { name: "coachUserId", in: "query", schema: { type: "string", format: "uuid" } },
      ],
      responses: {
        200: {
          description: "Tệp CSV UTF-8 có BOM",
          content: { "text/csv": { schema: { type: "string", format: "binary" } } },
        },
        403: { description: "Thiếu quyền report.read" },
        422: { description: "Bộ lọc hoặc loại báo cáo không hợp lệ" },
      },
    },
  },
  "/ai-assist/suggestions": {
    get: {
      tags: ["AI assist"],
      summary: "Coach xem bản nháp gợi ý AI",
      description:
        "Chỉ Coach xem được gợi ý tạo từ lịch, booking, điểm danh, giáo án và gói tập sắp hết hạn. Đây không phải chatbot hay tư vấn y khoa.",
      security: [{ sessionCookie: [] }],
      responses: {
        200: { description: "Bản nháp cần Coach rà soát" },
        403: { description: "Chỉ Coach có thể xem gợi ý" },
      },
    },
  },
  "/ai-assist/deliveries": {
    post: {
      tags: ["AI assist"],
      summary: "Coach duyệt và gửi hướng dẫn AI",
      description:
        "Coach có thể chỉnh nội dung trước khi gửi. Hệ thống kiểm tra hội viên trong scope Coach, lưu bản gửi, tạo thông báo cho hội viên và audit hành động.",
      security: [{ sessionCookie: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["memberId", "subject", "body"],
              properties: {
                memberId: { type: "string", format: "uuid" },
                subject: { type: "string", minLength: 3, maxLength: 160 },
                body: { type: "string", minLength: 3, maxLength: 1000 },
              },
            },
          },
        },
      },
      responses: {
        201: { description: "Đã lưu và gửi hướng dẫn được Coach duyệt" },
        403: { description: "Coach không có quyền hoặc hội viên ngoài scope" },
        422: { description: "Nội dung không hợp lệ" },
      },
    },
  },
  "/admin/permissions/matrix": {
    get: {
      tags: ["Role permissions"],
      summary: "Admin xem bảng quyền của bốn vai trò nghiệp vụ",
      description:
        "Trả danh mục permission, nhóm hiển thị và danh sách quyền được chọn cùng version của Manager, Lễ tân, Coach, Hội viên. Admin luôn toàn quyền và không phải một cột có thể chỉnh sửa.",
      security: [{ sessionCookie: [] }],
      responses: {
        200: {
          description: "Bảng quyền",
          content: { "application/json": { schema: { $ref: "#/components/schemas/RolePermissionMatrixResponse" } } },
        },
        401: { description: "Chưa đăng nhập" },
        403: { description: "Chỉ Admin được xem bảng quyền" },
      },
    },
  },
  "/admin/roles/{role}/permissions": {
    put: {
      tags: ["Role permissions"],
      summary: "Admin thay toàn bộ quyền của một vai trò",
      description:
        "Chỉ bốn vai trò nghiệp vụ được cấu hình. permissionCodes có thể rỗng. version chống ghi đè khi Admin khác đã lưu; cập nhật quyền và audit trong một transaction. Thu hồi quyền có hiệu lực ở request BE tiếp theo.",
      security: [{ sessionCookie: [] }],
      parameters: [
        {
          name: "role",
          in: "path",
          required: true,
          schema: { type: "string", enum: ["manager", "receptionist", "coach", "member"] },
        },
      ],
      requestBody: jsonBody({
        type: "object",
        additionalProperties: false,
        required: ["version", "permissionCodes"],
        properties: {
          version: { type: "integer", minimum: 0 },
          permissionCodes: { type: "array", uniqueItems: true, items: { type: "string", maxLength: 150 } },
        },
      }),
      responses: {
        200: {
          description: "Quyền đã lưu cùng version mới",
          content: { "application/json": { schema: { $ref: "#/components/schemas/RolePermissionUpdateResponse" } } },
        },
        401: { description: "Chưa đăng nhập" },
        403: { description: "Chỉ Admin được thay đổi quyền" },
        404: { description: "Role không tồn tại" },
        409: { description: "Version đã cũ; tải lại bảng trước khi lưu" },
        422: { description: "Role hoặc permission không hợp lệ, hoặc permission bị trùng" },
      },
    },
  },
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
};
