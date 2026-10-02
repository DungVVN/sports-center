import { ApiError } from "./api-error.js";

const fieldLabels = {
  amountVnd: "Số tiền", code: "Mã gói", durationDays: "Số ngày", endsOn: "Ngày kết thúc",
  memberId: "Hội viên", membershipId: "Gói chờ thanh toán", name: "Tên gói",
  packageId: "Gói tập", priceVnd: "Giá gói", reason: "Lý do", startsOn: "Ngày bắt đầu",
  tierRank: "Thứ hạng quyền",
};

function issueMessage(issue) {
  if (/expected (number|int|integer)/i.test(issue.message)) return "Cần nhập số hợp lệ.";
  if (/expected string/i.test(issue.message)) return "Cần nhập văn bản hợp lệ.";
  if (issue.code === "invalid_format" && /email/i.test(issue.message)) return "Email chưa đúng định dạng.";
  return issue.message;
}

export function fieldErrorsFor(error) {
  if (!(error instanceof ApiError) || error.code !== "VALIDATION_ERROR" || !Array.isArray(error.details)) return {};
  return error.details.reduce((errors, issue) => {
    if (typeof issue?.path !== "string" || typeof issue?.message !== "string") return errors;
    const field = issue.path.replace(/^(body|query|params)\./, "").split(".")[0];
    if (field && !errors[field]) errors[field] = issueMessage(issue);
    return errors;
  }, {});
}

export function errorMessageFor(error, fallback = "Không thể hoàn tất yêu cầu.") {
  if (error instanceof ApiError) {
    const issues = fieldErrorsFor(error);
    if (Object.keys(issues).length) {
      return Object.entries(issues).map(([field, message]) => `${fieldLabels[field] ?? field}: ${message}`).join("; ");
    }
    const context = fallback.replace(/[.\s]+$/, "");
    const requestId = error.requestId ? ` Mã tra cứu: ${error.requestId}.` : "";
    if (error.code === "NETWORK_ERROR") return `${context}: ${error.message || "không kết nối được máy chủ. Kiểm tra mạng rồi thử lại."}`;
    if (error.code === "REQUEST_TIMEOUT") return `${context}: ${error.message}`;
    if (error.status === 401 && error.code === "REQUEST_FAILED") return `${context}: phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.`;
    if (error.status === 403 && error.code === "REQUEST_FAILED") return `${context}: tài khoản không có quyền thực hiện thao tác này.`;
    if (error.status === 403 && error.code === "FORBIDDEN") return `${context}: tài khoản chưa được cấp quyền cho chức năng này. Liên hệ quản trị viên để kiểm tra phân quyền.`;
    if (error.status >= 500 && ["INTERNAL_ERROR", "REQUEST_FAILED"].includes(error.code)) {
      return `${context}: máy chủ chưa cung cấp nguyên nhân cụ thể. Vui lòng thử lại hoặc liên hệ quản trị viên.${requestId}`;
    }
    if (error.status >= 500) return `${error.message || fallback}${requestId}`;
    return error.message || fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
