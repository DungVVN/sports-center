import { serviceSchemas, serviceResponse } from "./service-schemas.js";

export function applyServiceContract(openApiSpec, { uuid, jsonBody, facilityAuth, facilityResponse, facilityRecord, facilityReservation, facilityReservationRecord }) {
  const courseSchema = { type: "object", properties: { id: uuid, name: { type: "string" }, status: { type: "string", enum: ["draft", "published", "cancelled", "completed"] }, priceVnd: { type: "string", pattern: "^\\d+$" }, capacity: { type: "integer" }, sessions: { type: "array", items: { type: "object" } }, reservedSeats: { type: "integer" } } };
  const refundOperation = (permission, summary, properties, required = []) => ({
    tags: ["Payments"], summary, "x-required-permission": permission, security: [{ sessionCookie: [] }, { sessionBearer: [] }],
    ...(properties && { parameters: [{ name: "id", in: "path", required: true, schema: uuid }], requestBody: jsonBody({ type: "object", properties, required }) }),
    responses: { 200: { description: "Thành công" }, 401: { description: "Chưa đăng nhập hoặc phiên hết hạn" }, 404: { description: "Không tìm thấy đối tượng trong phạm vi tài khoản" }, 403: { description: "Không đủ quyền hoặc sai vai trò" }, 409: { description: "Đã xử lý hoặc có yêu cầu hoàn tiền đang mở" }, 422: { description: "Dịch vụ đã sử dụng hoặc không đủ điều kiện" } },
  });
  const refundNote = { type: "string", minLength: 10, maxLength: 500 };
  Object.assign(openApiSpec.paths, {
    "/service-refunds": { get: refundOperation("payment.refund.read", "Hoàn tiền dịch vụ: khách chỉ xem của mình") },
    "/payments/{id}/refund-request": { post: refundOperation("payment.refund.request", "Yêu cầu hoàn toàn bộ dịch vụ chưa sử dụng; không áp dụng membership", { reason: refundNote }, ["reason"]) },
    "/service-refunds/{id}/review": { post: refundOperation("payment.refund.review", "Quản lý duyệt/từ chối; duyệt thu hồi quyền sử dụng trong cùng transaction", { approved: { type: "boolean" }, note: refundNote }, ["approved", "note"]) },
    "/service-refunds/{id}/execute": { post: refundOperation("payment.refund.execute", "Ghi nhận đã trả tiền thực tế và mã đối soát; không tự chuyển tiền", { transferReference: refundNote }, ["transferReference"]) },
    "/payments/{id}/reconcile": { post: refundOperation("payment.reconcile", "Thử cấp lại dịch vụ đã thu nhưng lỗi; vẫn kiểm tra điều kiện dịch vụ", { note: refundNote }, ["note"]) },
  });
  const courseOperation = (permission, summary, schema, status = 200, body) => ({
    tags: ["Courses"], summary, "x-required-permission": permission, security: [{ sessionCookie: [] }, { sessionBearer: [] }],
    description: `Yêu cầu quyền ${permission}. Khóa có quyền đăng ký riêng, không yêu cầu membership. Giá được lưu tại lúc đăng ký; đăng ký chờ thanh toán giữ chỗ.`,
    ...(body && { requestBody: { required: true, content: { "application/json": { schema: body } } } }),
    responses: { 401: { description: "Chưa đăng nhập hoặc phiên hết hạn" }, 404: { description: "Không tìm thấy dịch vụ/đăng ký trong phạm vi tài khoản" }, [status]: { description: "Thành công", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: schema } } } } }, 403: { description: "Không đủ quyền" }, 409: { description: "Đã đăng ký, hết chỗ hoặc giao dịch đang xử lý" }, 422: { description: "Khóa hoặc đăng ký không đủ điều kiện" } },
  });
  Object.assign(openApiSpec.paths, {
    "/facility-settings": { get: facilityAuth("facility.manage", facilityResponse({ type: "object", properties: { facilities: { type: "array", items: facilityRecord }, rooms: { type: "array", items: { type: "object", properties: { id: uuid, name: { type: "string" } } } } } }), "Cấu hình giá và liên kết phòng vật lý; dành cho người quản lý sân.") },
    "/facilities/{id}/configuration": { patch: { ...facilityAuth("facility.manage", facilityResponse({ type: "object", properties: { id: uuid, hourlyRateVnd: { type: "string" }, roomId: { type: ["string", "null"], format: "uuid" } } }), "Đơn giá theo giờ; phòng liên kết phải không tạo xung đột lịch. Đơn cũ giữ nguyên giá chốt."), parameters: [{ name: "id", in: "path", required: true, schema: uuid }], requestBody: jsonBody({ type: "object", required: ["hourlyRateVnd"], properties: { hourlyRateVnd: { type: "string", pattern: "^[0-9]{1,12}$" }, roomId: { type: ["string", "null"], format: "uuid" } } }) } },
    "/facility-reservations/{id}/payment": { post: { ...facilityAuth("facility.booking.request", facilityResponse({ type: "object" }), "Người tạo đơn lập thanh toán theo giá server đã chốt; không cần membership. Tiếp tục giao dịch đang xử lý nếu đã có."), parameters: [{ name: "id", in: "path", required: true, schema: uuid }], requestBody: jsonBody({ type: "object", required: ["method"], properties: { method: { enum: ["bank_transfer", "online"] } } }) } },
    "/facility-reservations/{id}/complete": { post: { ...facilityAuth("facility.booking.approve", facilityResponse({ type: "object", properties: { id: uuid, completedAt: { type: "string", format: "date-time" } } }), "Chốt sử dụng sau khung giờ; đơn mới phải trả tiền hoặc miễn phí; đơn lịch sử giữ điều kiện cũ."), parameters: [{ name: "id", in: "path", required: true, schema: uuid }], requestBody: jsonBody({ type: "object", required: ["note"], properties: { note: { type: "string", minLength: 3, maxLength: 500 } } }) } },
    "/courses": {
      get: courseOperation("course.read", "Danh mục khóa và lịch nhiều buổi", { type: "array", items: courseSchema }),
      post: courseOperation("course.manage", "Tạo khóa nháp", courseSchema, 201, { type: "object", required: ["name", "priceVnd", "capacity"], properties: { name: { type: "string", minLength: 2, maxLength: 120 }, description: { type: "string", maxLength: 1000 }, priceVnd: { type: "string", pattern: "^\\d+$" }, capacity: { type: "integer", minimum: 1, maximum: 500 }, paymentHoldMinutes: { type: "integer", minimum: 5, maximum: 1440, default: 60 } } }),
    },
    "/courses/{id}/sessions": { post: courseOperation("course.manage", "Thêm buổi vào khóa nháp", { type: "object" }, 201, { type: "object", required: ["coachUserId", "roomId", "startsAt", "endsAt"], properties: { name: { type: "string" }, coachUserId: uuid, roomId: uuid, startsAt: { type: "string", format: "date-time" }, endsAt: { type: "string", format: "date-time" } } }) },
    "/courses/{id}/publish": { post: courseOperation("course.manage", "Công bố khóa và toàn bộ buổi trong một transaction", courseSchema) },
    "/courses/{id}/complete": { post: courseOperation("course.manage", "Chốt khóa sau khi mọi buổi đã kết thúc/xử lý hủy và không còn đăng ký chờ thanh toán", courseSchema) },
    "/courses/{id}/enroll": { post: courseOperation("course.enroll", "Đăng ký trọn khóa cho chính mình", { type: "object" }, 201) },
    "/course-enrollments/me": { get: courseOperation("course.enroll", "Đăng ký khóa của tôi", { type: "array", items: { type: "object" } }) },
    "/course-enrollments": { get: courseOperation("course.enrollment.read", "Đăng ký khóa để vận hành", { type: "array", items: { type: "object" } }) },
    "/course-enrollments/{id}/cancel": { post: courseOperation("course.enroll", "Hủy đăng ký chưa có giao dịch đang xử lý hoặc đã thanh toán", { type: "object" }) },
    "/course-enrollments/{id}/payment": { post: courseOperation("course.enroll", "Tạo thanh toán từ giá khóa đã chốt; kích hoạt và đặt toàn bộ buổi khi đã thu", { type: "object" }, 201, { type: "object", required: ["method"], properties: { method: { type: "string", enum: ["bank_transfer", "online"] } } }) },
  });


  const ptResult = { type: "object" };
  const ptOp = (permission, summary, schema = ptResult, body, status = 200) => ({ ...courseOperation(permission, summary, schema, status, body), tags: ["Personal training"], description: `Quyền ${permission}. Gói PT độc lập membership; giá/số buổi/hạn dùng lưu snapshot. Khách chỉ thao tác gói của mình; coach chỉ ghi kết quả trong scope được phân công. Đặt lịch giữ buổi; hủy hợp lệ trả lại buổi; hoàn thành/vắng mặt sử dụng buổi.` });
  Object.assign(openApiSpec.paths, {
    "/pt-packages/{id}/availability": { patch: ptOp("pt.manage", "Mở/dừng bán gói PT; quyền lợi đã mua giữ nguyên", ptResult, { type: "object", required: ["isActive"], properties: { isActive: { type: "boolean" } } }) },
    "/pt-purchases/{id}/cancel": { post: ptOp("pt.purchase", "Hủy đăng ký PT chưa có giao dịch đang xử lý/đã thanh toán") },
   "/pt-packages": { get: ptOp("pt.read", "Danh mục gói PT", { type: "array", items: ptResult }), post: ptOp("pt.manage", "Tạo gói PT", ptResult, { type: "object", required: ["name","priceVnd","sessionCount","durationDays","sessionMinutes","cancellationHours"], properties: { name: { type: "string", minLength: 2, maxLength: 120 }, description: { type: "string", maxLength: 1000 }, priceVnd: { type: "string", pattern: "^\\d+$" }, sessionCount: { type: "integer", minimum: 1, maximum: 500 }, durationDays: { type: "integer", minimum: 1, maximum: 730 }, sessionMinutes: { type: "integer", minimum: 15, maximum: 240 }, cancellationHours: { type: "integer", minimum: 0, maximum: 168 } } }, 201) },
   "/pt-purchases": { get: ptOp("pt.read", "Gói PT và số buổi trong phạm vi tài khoản", { type: "array", items: ptResult }) },
   "/pt-resources": { get: ptOp("pt.read", "Phòng và coach thuộc trung tâm") },
   "/pt-packages/{id}/buy": { post: ptOp("pt.purchase", "Mua gói PT cho chính mình", ptResult, undefined, 201) },
   "/pt-purchases/{id}/payment": { post: ptOp("pt.purchase", "Lập hoặc mở lại thanh toán giá PT đã chốt", ptResult, { type: "object", required: ["method"], properties: { method: { type: "string", enum: ["bank_transfer", "online"] } } }, 201) },
   "/pt-purchases/{id}/coach": { patch: ptOp("pt.manage", "Trung tâm phân công coach; không đổi khi còn lịch chưa xử lý", ptResult, { type: "object", required: ["coachUserId"], properties: { coachUserId: uuid } }) },
   "/pt-purchases/{id}/appointments": { post: ptOp("pt.purchase", "Đặt một buổi PT, chặn trùng coach/phòng và hết số buổi", ptResult, { type: "object", required: ["roomId", "startsAt"], properties: { roomId: uuid, startsAt: { type: "string", format: "date-time" } } }, 201) },
   "/pt-appointments/{id}/cancel": { post: ptOp("pt.purchase", "Hủy buổi PT trong hạn gói; giải phóng lịch và số buổi", ptResult, { type: "object", required: ["reason"], properties: { reason: { type: "string", minLength: 3, maxLength: 500 } } }) },
   "/pt-appointments/{id}/staff-cancel": { post: ptOp("pt.manage", "Trung tâm hủy lịch PT có lý do, trả lại số buổi và thông báo khách", ptResult, { type: "object", required: ["reason"], properties: { reason: { type: "string", minLength: 3, maxLength: 500 } } }) },
   "/pt-appointments/{id}/complete": { post: ptOp("pt.complete", "Coach ghi hoàn thành hoặc vắng mặt một lần; điểm danh và audit cùng transaction", ptResult, { type: "object", required: ["status", "reason"], properties: { status: { type: "string", enum: ["completed", "absent"] }, reason: { type: "string", minLength: 3, maxLength: 500 } } }) },
  });


  Object.assign(openApiSpec.components.schemas, serviceSchemas);
  const responses = [
    ["/public/courses", "get", 200, "PublicCourse", true],
    ["/public/pt-packages", "get", 200, "PublicPtPackage", true],
    ["/courses", "get", 200, "Course", true],
    ["/courses", "post", 201, "Course"],
    ["/courses/{id}/sessions", "post", 201, "ServiceClassSession"],
    ["/courses/{id}/publish", "post", 200, "Course"],
    ["/courses/{id}/complete", "post", 200, "Course"],
    ["/courses/{id}/enroll", "post", 201, "CourseEnrollment"],
    ["/course-enrollments/me", "get", 200, "CourseEnrollment", true],
    ["/course-enrollments", "get", 200, "CourseEnrollment", true],
    ["/course-enrollments/{id}/cancel", "post", 200, "CourseEnrollment"],
    ["/pt-packages", "get", 200, "PtPackage", true],
    ["/pt-packages", "post", 201, "PtPackage"],
    ["/pt-packages/{id}/availability", "patch", 200, "PtPackage"],
    ["/pt-purchases", "get", 200, "PtPurchase", true],
    ["/pt-packages/{id}/buy", "post", 201, "PtPurchase"],
    ["/pt-purchases/{id}/cancel", "post", 200, "PtPurchase"],
    ["/pt-purchases/{id}/coach", "patch", 200, "PtPurchase"],
    ["/pt-resources", "get", 200, "PtResources"],
    ["/pt-purchases/{id}/appointments", "post", 201, "PtAppointment"],
    ["/pt-appointments/{id}/cancel", "post", 200, "PtAppointment"],
    ["/pt-appointments/{id}/staff-cancel", "post", 200, "PtAppointment"],
    ["/pt-appointments/{id}/complete", "post", 200, "PtAppointment"],
    ["/course-enrollments/{id}/payment", "post", 201, "ServicePayment"],
    ["/pt-purchases/{id}/payment", "post", 201, "ServicePayment"],
    ["/facility-reservations/{id}/payment", "post", 200, "ServicePayment"],
    ["/payments", "post", 201, "ServicePayment"],
    ["/payments/{id}/reconcile", "post", 200, "ServicePayment"],
    ["/service-refunds", "get", 200, "ServiceRefund", true],
    ["/payments/{id}/refund-request", "post", 200, "ServiceRefund"],
    ["/service-refunds/{id}/review", "post", 200, "ServiceRefund"],
    ["/service-refunds/{id}/execute", "post", 200, "ServiceRefund"],
  ];
  for (const [path, method, status, name, list] of responses) {
    openApiSpec.paths[path][method].responses[status].content = { "application/json": { schema: serviceResponse(name, list) } };
  }
  openApiSpec.paths["/public/pt-packages"].get.tags = ["Personal training"];
  openApiSpec.paths["/public/courses"].get.description = "Không cần đăng nhập. Chỉ trả khóa đã công bố, có buổi học và mọi buổi còn ở tương lai. availableSeats đã trừ chỗ giữ thanh toán chưa hết hạn; không trả danh sách học viên.";
  const payment = openApiSpec.paths["/payments"].post;
  Object.assign(payment.requestBody.content["application/json"].schema.properties, { courseEnrollmentId: uuid, ptPurchaseId: uuid, facilityReservationId: uuid });
  payment.description = "Quyền payment.record; Admin/Lễ tân thu tiền. Chỉ gắn tối đa một trong membershipId, courseEnrollmentId, ptPurchaseId, facilityReservationId. amountVnd phải khớp giá snapshot; phiếu độc lập không gắn dịch vụ vẫn được hỗ trợ. Phương thức mặc định cash. Online bắt buộc provider=payos và chờ webhook; bank_transfer cần đối soát khi xác nhận paid. Đã thu nhưng cấp dịch vụ thất bại giữ tiền và ghi fulfillment_error để chờ đối soát, không tự bỏ điều kiện lịch/số chỗ.";
  payment.requestBody.content["application/json"].example = { memberId: "11111111-1111-4111-8111-111111111111", courseEnrollmentId: "22222222-2222-4222-8222-222222222222", amountVnd: 500000, method: "cash" };
  const course = openApiSpec.paths["/courses"].post;
    course.requestBody.content["application/json"].schema.properties.priceVnd.description = "Số nguyên VND không âm, tối đa 1000000000000.";
  course.requestBody.content["application/json"].example = { name: "Yoga 12 buổi", priceVnd: "1200000", capacity: 15, paymentHoldMinutes: 60 };
  const session = openApiSpec.paths["/courses/{id}/sessions"].post.requestBody.content["application/json"].schema.properties;
  session.name = { type: "string", minLength: 2, maxLength: 120 };
  const pt = openApiSpec.paths["/pt-packages"].post;
  pt.requestBody.content["application/json"].schema.properties.priceVnd.description = "Số nguyên VND không âm, tối đa 1000000000000.";
  pt.requestBody.content["application/json"].example = { name: "PT 10 buổi", priceVnd: "3000000", sessionCount: 10, durationDays: 60, sessionMinutes: 60, cancellationHours: 5 };
  for (const [path, method] of [["/pt-packages/{id}/availability", "patch"], ["/facilities/{id}/configuration", "patch"], ["/payments/{id}/refund-request", "post"], ["/service-refunds/{id}/review", "post"], ["/service-refunds/{id}/execute", "post"], ["/payments/{id}/reconcile", "post"]]) {
    openApiSpec.paths[path][method].requestBody.content["application/json"].schema.additionalProperties = false;
  }
  const avatar = openApiSpec.paths["/auth/profile"].patch.requestBody.content["application/json"].schema.properties.avatarUrl;
  avatar.pattern = "^[Hh][Tt][Tt][Pp][Ss]://[^/?#@]+(?:[/?#]|$)";
  avatar.description = "URL HTTPS không chứa username/password, hoặc null để xóa ảnh đại diện.";
  openApiSpec.paths["/auth/registrations/{userId}/approve"].post.description = "Quyền registration.approve. Duyệt và audit cùng transaction; thao tác đồng thời chỉ một lần thành công, lần còn lại trả 409 REGISTRATION_NOT_PENDING.";
  openApiSpec.paths["/auth/registrations/{userId}/approve"].post.responses[409] = { description: "Đăng ký đã được xử lý (REGISTRATION_NOT_PENDING)" };

  Object.assign(facilityRecord.properties, { hourly_rate_vnd: { type: "string", pattern: "^[0-9]+$" }, room_id: { type: ["string", "null"], format: "uuid" } });
  Object.assign(facilityReservationRecord.properties, { total_vnd_snapshot: { type: ["string", "null"], pattern: "^[0-9]+$" }, hourly_rate_vnd_snapshot: { type: ["string", "null"], pattern: "^[0-9]+$" }, payment_state: { type: "string", enum: ["legacy", "unpaid", "paid", "free", "refunded"] }, completed_at: { type: ["string", "null"], format: "date-time" } });
  Object.assign(facilityReservation.properties, { totalVnd: { type: ["string", "null"], pattern: "^[0-9]+$" }, hourlyRateVnd: { type: ["string", "null"], pattern: "^[0-9]+$" }, paymentState: { type: "string", enum: ["legacy", "unpaid", "paid", "free", "refunded"] }, completedAt: { type: ["string", "null"], format: "date-time" }, completionNote: { type: ["string", "null"] }, activationPaymentId: { type: ["string", "null"], format: "uuid" } });
  openApiSpec.paths["/facilities/{id}/configuration"].patch.description += " Nếu không truyền roomId hoặc truyền null, hệ thống bỏ liên kết phòng hiện tại.";
  openApiSpec.paths["/service-refunds"].get.description = "Quyền payment.refund.read. Member chỉ đọc yêu cầu của mình; Admin, Manager, Lễ tân đọc danh sách vận hành. Coach không được truy cập.";
  openApiSpec.paths["/payments/{id}/refund-request"].post.description = "Quyền payment.refund.request và vai trò Member hoặc Admin. Chỉ hoàn toàn bộ dịch vụ đã thu nhưng chưa sử dụng; không áp dụng membership. Một giao dịch chỉ có một yêu cầu đang mở hoặc đã hoàn tất.";
  openApiSpec.paths["/service-refunds/{id}/review"].post.description = "Quyền payment.refund.review và vai trò Manager hoặc Admin. Duyệt/từ chối một lần; duyệt hủy quyền lợi/lịch chưa sử dụng trong cùng transaction.";
  openApiSpec.paths["/service-refunds/{id}/execute"].post.description = "Quyền payment.refund.execute và vai trò Lễ tân hoặc Admin. Chỉ thực hiện sau duyệt, lưu mã đối soát trả tiền thực tế; endpoint không chuyển tiền tự động.";
  openApiSpec.paths["/payments/{id}/reconcile"].post.description = "Quyền payment.reconcile và vai trò Manager hoặc Admin. Chỉ xử lý payment paid có fulfillment_error; kiểm tra lại điều kiện trước cấp quyền, không cấp khi có yêu cầu hoàn tiền.";

  const authenticatedOperations = new Set(responses.map(([path, method]) => `${method} ${path}`).filter((key) => !key.includes("/public/")));
  for (const path of ["/facility-settings", "/facilities/{id}/configuration", "/facility-reservations/{id}/complete"]) {
    for (const method of Object.keys(openApiSpec.paths[path])) authenticatedOperations.add(`${method} ${path}`);
  }
  for (const key of authenticatedOperations) {
    const [method, path] = key.split(" ");
    const operation = openApiSpec.paths[path][method];
    operation.security = [{ sessionCookie: [] }, { adminSessionCookie: [] }, { sessionBearer: [] }];
    operation.parameters ??= [];
    operation.parameters.push({ name: "x-sports-center-portal", in: "header", required: false, schema: { type: "string", enum: ["main", "admin"] }, description: "Cookie admin cần cổng admin. Khi dùng Swagger cùng domain API, truyền admin; nếu có Origin thì header phải khớp domain cổng." });
    operation.responses[401] ??= { description: "Chưa đăng nhập, phiên hết hạn hoặc sai cổng đăng nhập" };
    operation.responses[404] ??= { description: "Không tìm thấy đối tượng trong phạm vi tài khoản" };
  }
}
