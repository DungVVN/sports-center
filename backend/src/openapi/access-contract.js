import { uuid } from "./contract-helpers.js";

export function applyAccessContract(openApiSpec) {
  openApiSpec.paths["/auth/me"].get.responses[200].content = {
    "application/json": { schema: { $ref: "#/components/schemas/CurrentSessionResponse" } },
  };
  for (const method of ["get", "patch"]) {
    openApiSpec.paths["/auth/profile"][method].responses[200].content = {
      "application/json": {
        schema: {
          type: "object",
          required: ["success", "data"],
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              required: ["id", "role", "profileSetupRequired"],
              properties: {
                id: uuid,
                role: { type: "string", enum: ["admin", "manager", "receptionist", "coach", "member"] },
                profileSetupRequired: { type: "boolean" },
              },
            },
          },
        },
      },
    };
  }
  openApiSpec.paths["/health"].get.servers = [{ url: "/" }];
  openApiSpec.paths["/classes/{id}/change-requests"].post.responses[201].description =
    "Yêu cầu chờ Admin hoặc Lễ tân duyệt";
  openApiSpec.paths["/memberships/{id}/freeze-requests"].post.description =
    "Yêu cầu quyền membership.freeze.request. Hội viên chỉ có thể yêu cầu cho gói đang hoạt động của chính mình; sau khi Admin hoặc Lễ tân duyệt, hệ thống cộng bù đúng số ngày đóng băng.";
  openApiSpec.paths["/memberships/{id}/freeze-requests"].post.responses[201].description =
    "Yêu cầu chờ Admin hoặc Lễ tân duyệt";

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
  openApiSpec.paths["/ai-assist/suggestions"].get.description =
    "Yêu cầu quyền ai.assist.read. Gợi ý dựa trên phạm vi vận hành của tài khoản; đây không phải chatbot hay tư vấn y khoa.";
  openApiSpec.paths["/ai-assist/suggestions"].get.responses[403].description = "Thiếu quyền ai.assist.read";
  openApiSpec.paths["/ai-assist/deliveries"].post.summary = "Rà soát và gửi hướng dẫn AI theo quyền được cấp";
  openApiSpec.paths["/ai-assist/deliveries"].post.description =
    "Yêu cầu quyền ai.assist.deliver. Coach chỉ gửi cho hội viên trong phạm vi phân công; người dùng khác được cấp quyền có thể gửi cho hội viên hợp lệ.";
  openApiSpec.paths["/ai-assist/deliveries"].post.responses[403].description =
    "Thiếu quyền ai.assist.deliver hoặc hội viên ngoài phạm vi Coach";
  openApiSpec.paths["/support-tickets/{id}/assign-self"].post.summary = "Người có quyền xử lý nhận phụ trách ticket";
  openApiSpec.paths["/support-tickets/{id}/assign-self"].post.responses[403].description =
    "Thiếu quyền support.ticket.respond hoặc ngoài phạm vi ticket";
  openApiSpec.paths["/support-tickets/{id}/responses"].post.responses[403].description =
    "Thiếu quyền support.ticket.respond hoặc ngoài phạm vi ticket";
  openApiSpec.paths["/support-tickets"].get.description =
    "Yêu cầu quyền support.ticket.read. Hội viên chỉ xem ticket của chính mình; các vai trò khác xem hàng chờ vận hành khi được cấp quyền.";
  openApiSpec.paths["/support-tickets/{id}/responses"].post.description =
    "Yêu cầu quyền support.ticket.respond. Phản hồi tạo thông báo cho chủ ticket; hội viên chỉ thao tác trong ticket của chính mình.";
  openApiSpec.paths["/classes/{id}/change-requests"].post.description =
    "Yêu cầu quyền class.change.request. Coach chỉ đề xuất cho lớp mình phụ trách; vai trò khác được cấp quyền có thể đề xuất cho lớp đang công bố.";
  openApiSpec.paths["/admin/roles/{role}/permissions"].put.description +=
    " Các quyền có requires phải được cấp kèm quyền phụ thuộc; quyền tự phục vụ cần hồ sơ hội viên nên chỉ áp dụng cho Member. Danh mục quyền chỉ gồm các API hiện được thực thi.";
  const permissionItemSchema =
    openApiSpec.components.schemas.RolePermissionMatrixResponse.properties.data.properties.permissions.items;
  permissionItemSchema.required.push("requiresByRole");
  permissionItemSchema.properties.requiresByRole = {
    type: "object",
    description: "Quyền phụ thuộc riêng từng vai trò; ví dụ nhân viên cần member.read để tạo booking cho hội viên.",
    additionalProperties: { type: "array", items: { type: "string" } },
  };

  const permissionDescriptions = [
    [
      "/auth/registrations/pending",
      "get",
      "registration.approve",
      "Người được cấp quyền xem danh sách đăng ký chờ duyệt.",
    ],
    [
      "/auth/registrations/{userId}/approve",
      "post",
      "registration.approve",
      "Người được cấp quyền duyệt tài khoản hội viên.",
    ],
    [
      "/classes/{id}/change-requests",
      "post",
      "class.change.request",
      "Người được cấp quyền đề xuất đổi lớp; Coach chỉ thao tác lớp mình phụ trách.",
    ],
    ["/class-change-requests", "get", "class.change.review", "Người được cấp quyền xem yêu cầu đổi lớp."],
    [
      "/class-change-requests/{id}",
      "patch",
      "class.change.review",
      "Người được cấp quyền duyệt hoặc từ chối yêu cầu đổi lớp.",
    ],
    [
      "/membership-freeze-requests/{id}",
      "patch",
      "membership.freeze.review",
      "Người được cấp quyền duyệt hoặc từ chối yêu cầu đóng băng.",
    ],
    [
      "/memberships/{id}/cancel-pending-renewal",
      "patch",
      "membership.assign",
      "Người được cấp quyền hủy gia hạn chờ thanh toán.",
    ],
    [
      "/members/{id}/memberships",
      "post",
      "membership.assign",
      "Người được cấp quyền tạo gói chờ thanh toán cho hội viên.",
    ],
  ];
  for (const [path, method, permission, summary] of permissionDescriptions) {
    const operation = openApiSpec.paths[path][method];
    operation.summary = summary;
    operation["x-required-permission"] = permission;
    operation.responses[403] = { description: `Thiếu quyền ${permission} hoặc ngoài phạm vi dữ liệu` };
  }
  openApiSpec.paths["/auth/registrations/pending"].get.description =
    "Yêu cầu quyền registration.approve; Admin luôn có mọi quyền.";
  openApiSpec.paths["/memberships/{id}/freeze-requests"].post.description =
    "Yêu cầu quyền membership.freeze.request và hồ sơ Hội viên. Chỉ được đề xuất đóng băng gói của chính mình.";
  openApiSpec.paths["/payments"].get.description =
    "Yêu cầu quyền payment.read; quyền lập phiếu thu được cấu hình riêng bằng payment.record.";
  openApiSpec.paths["/payments"].get.responses[200].description =
    "Phiếu thu kèm hội viên và gói đã gắn; giao dịch VNPAY lịch sử vẫn có provider=vnpay từ legacy_provider, nhưng không thể tạo VNPAY mới.";
  openApiSpec.paths["/members/me/payments"].get.responses[200].description =
    "Lịch sử giao dịch read-only, gồm nhãn nhà cung cấp VNPAY cũ nếu có.";
  openApiSpec.paths["/members/me/payments/{id}"].get.responses[200].description =
    "Biên lai giao dịch thuộc hội viên; VNPAY lịch sử được giữ nhãn qua legacy_provider.";
  openApiSpec.paths["/payments"].post.summary = "Người có quyền lập phiếu thu hoặc link PayOS";
  openApiSpec.paths["/payments"].post["x-required-permission"] = "payment.record";
  openApiSpec.paths["/payments/{id}/confirm"].post.summary = "Người có quyền xác nhận tiền mặt/chuyển khoản";
  openApiSpec.paths["/payments/{id}/confirm"].post["x-required-permission"] = "payment.record";
  openApiSpec.paths["/bookings"].get.description =
    "Yêu cầu quyền booking.read. Hội viên chỉ xem lịch của mình; Coach chỉ xem lớp mình phụ trách; các vai trò khác được cấp quyền xem lịch vận hành.";
  openApiSpec.paths["/bookings"].post.description =
    "Yêu cầu quyền booking.write. Hội viên chỉ đặt cho mình; các vai trò khác được cấp quyền có thể đặt cho hội viên và cần thêm quyền member.read để chọn hội viên. Trạng thái lớp, hiệu lực gói và quyền đặt lớp được kiểm tra lại trong giao dịch tạo booking khóa lớp; waitlist không chiếm chỗ xác nhận.";
  openApiSpec.paths["/bookings"].post.requestBody.content["application/json"].schema.properties.memberId.description =
    "Bắt buộc khi người không phải Hội viên đặt thay hội viên.";
  openApiSpec.paths["/bookings/{id}/cancel"].patch.description =
    "Yêu cầu quyền booking.write. Hội viên chỉ hủy booking của mình trước giờ học ít nhất 5 tiếng; người được cấp quyền ở vai trò khác có thể hủy cho hội viên.";
  openApiSpec.paths["/bookings"].post["x-required-permission"] = "booking.write";
  openApiSpec.paths["/bookings/{id}/cancel"].patch["x-required-permission"] = "booking.write";

}
