import { AppError } from "../errors/app-error.js";

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  const appError = error instanceof AppError
    ? error
    : new AppError({
      statusCode: 500,
      code: "INTERNAL_ERROR",
      message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
    });

  if (appError.statusCode >= 500) {
    console.error(error);
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
