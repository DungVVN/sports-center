import { AppError } from "../errors/app-error.js";
import { portalSurfaceFromRequest, sessionCookieNames } from "./portal-session.js";

function tokenFromRequest(request) {
  const bearer = request.get("authorization");
  if (bearer?.startsWith("Bearer ")) return { token: bearer.slice(7), fromCookie: false };
  return { token: request.cookies?.[sessionCookieNames[portalSurfaceFromRequest(request)]], fromCookie: true };
}

export function authenticate(authService) {
  return async (request, response, next) => {
    try {
      const { token, fromCookie } = tokenFromRequest(request);
      if (!token) throw new AppError({ statusCode: 401, code: "UNAUTHENTICATED", message: "Bạn cần đăng nhập để tiếp tục." });
      request.auth = await authService.getAuthentication(token);
      if (fromCookie && (request.auth.user.role === "admin") !== (portalSurfaceFromRequest(request) === "admin")) {
        throw new AppError({ statusCode: 401, code: "WRONG_PORTAL_SESSION", message: "Phiên đăng nhập không thuộc cổng này." });
      }
      request.auth.token = token;
      const allowedDuringInitialPasswordChange = new Set(["/api/v1/auth/me", "/api/v1/auth/password/change", "/api/v1/auth/logout"]);
      if (request.auth.user.mustChangePassword && !allowedDuringInitialPasswordChange.has(request.originalUrl.split("?")[0])) {
        throw new AppError({ statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED", message: "Bạn cần đổi mật khẩu tạm thời trước khi tiếp tục." });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePermission(permission) {
  return (request, response, next) => {
    if (request.auth?.user?.role !== "admin" && !request.auth?.permissions.includes(permission)) {
      return next(new AppError({ statusCode: 403, code: "FORBIDDEN", message: "Bạn không có quyền thực hiện thao tác này." }));
    }
    return next();
  };
}
