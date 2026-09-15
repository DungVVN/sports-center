import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requireTrustedOrigin(request, response, next) {
  if (!unsafeMethods.has(request.method)) return next();

  const origin = request.get("origin");
  if (!origin || env.corsOrigins.includes(origin)) return next();

  return next(new AppError({
    statusCode: 403,
    code: "UNTRUSTED_ORIGIN",
    message: "Nguồn gửi yêu cầu không được phép.",
  }));
}
