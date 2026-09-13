import { notFoundError } from "../errors/app-error.js";

export function notFound(request, response, next) {
  next(notFoundError(`Không tìm thấy ${request.method} ${request.originalUrl}.`));
}
