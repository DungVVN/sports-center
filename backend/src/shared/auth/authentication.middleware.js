import { AppError } from "../errors/app-error.js";

function tokenFromRequest(request) {
  const bearer = request.get("authorization");
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7);
  return request.cookies?.sports_center_session;
}

export function authenticate(authService) {
  return async (request, response, next) => {
    try {
      const token = tokenFromRequest(request);
      if (!token) throw new AppError({ statusCode: 401, code: "UNAUTHENTICATED", message: "Bạn cần đăng nhập để tiếp tục." });
      request.auth = await authService.getAuthentication(token);
      request.auth.token = token;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePermission(permission) {
  return (request, response, next) => {
    if (!request.auth?.permissions.includes(permission)) {
      return next(new AppError({ statusCode: 403, code: "FORBIDDEN", message: "Bạn không có quyền thực hiện thao tác này." }));
    }
    return next();
  };
}
