import { AppError } from "../errors/app-error.js";
import { isDatabaseUnavailable } from "../errors/database-error.js";

const requestBodyErrors = new Map([
  ["entity.parse.failed", { statusCode: 400, code: "INVALID_JSON", message: "Nội dung JSON không hợp lệ." }],
  ["entity.too.large", { statusCode: 413, code: "PAYLOAD_TOO_LARGE", message: "Nội dung yêu cầu vượt quá giới hạn cho phép." }],
  ["encoding.unsupported", { statusCode: 415, code: "UNSUPPORTED_ENCODING", message: "Mã hóa nội dung yêu cầu không được hỗ trợ." }],
  ["charset.unsupported", { statusCode: 415, code: "UNSUPPORTED_CHARSET", message: "Bảng mã nội dung yêu cầu không được hỗ trợ." }],
]);

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  const appError = error instanceof AppError
    ? error
    : requestBodyErrors.has(error?.type) ? new AppError(requestBodyErrors.get(error.type))
    : isDatabaseUnavailable(error) ? new AppError({
      statusCode: 503,
      code: "DATABASE_UNAVAILABLE",
      message: "Kết nối dữ liệu tạm thời gián đoạn. Vui lòng thử lại sau ít phút.",
    }) : new AppError({
      statusCode: 500,
      code: "INTERNAL_ERROR",
      message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
    });

  if (appError.statusCode >= 500) {
    // Error messages, stacks and provider payloads may contain credentials or personal data.
    console.error({ event: "request_failed", statusCode: appError.statusCode, code: appError.code, requestId: request.id });
  }

  return response.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
      requestId: request.id,
    },
  });
}
