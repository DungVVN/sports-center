import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

export const sessionCookieNames = Object.freeze({
  main: "sports_center_session",
  admin: "sports_center_admin_session",
});

const adminOrigin = "https://admin.kineticsports.io.vn";

export function portalSurfaceFromRequest(request) {
  const requested = request.get("x-sports-center-portal");
  const origin = request.get("origin");
  const inferred = origin === adminOrigin ? "admin" : "main";

  if (requested && requested !== "main" && requested !== "admin") {
    throw new AppError({ statusCode: 400, code: "INVALID_PORTAL_SURFACE", message: "Cổng đăng nhập không hợp lệ." });
  }
  if (env.nodeEnv === "production" && origin && requested && requested !== inferred) {
    throw new AppError({ statusCode: 403, code: "PORTAL_ORIGIN_MISMATCH", message: "Cổng đăng nhập không khớp tên miền." });
  }
  return requested ?? inferred;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    secure: env.nodeEnv === "production",
    path: env.apiBasePath,
  };
}
