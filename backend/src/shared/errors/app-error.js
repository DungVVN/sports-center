export class AppError extends Error {
  constructor({ statusCode, code, message, details }) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function notFoundError(message = "Không tìm thấy tài nguyên.") {
  return new AppError({ statusCode: 404, code: "NOT_FOUND", message });
}
