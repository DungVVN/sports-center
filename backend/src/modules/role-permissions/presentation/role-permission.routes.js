import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../../shared/auth/authentication.middleware.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { sendSuccess } from "../../../shared/http/response.js";
import { validateRequest } from "../../../shared/validation/validate-request.js";

function adminOnly(request, response, next) {
  if (request.auth.user.role !== "admin") return next(new AppError({ statusCode: 403, code: "ADMIN_REQUIRED", message: "Chỉ Quản trị hệ thống được cấu hình quyền." }));
  return next();
}

export function createRolePermissionRouter(service, authService) {
  const router = Router();
  const secure = [authenticate(authService), adminOnly];
  router.get("/admin/permissions/matrix", ...secure, async (request, response, next) => {
    try { sendSuccess(response, { data: await service.matrix() }); } catch (error) { next(error); }
  });
  router.put("/admin/roles/:role/permissions", ...secure, validateRequest(z.object({
    params: z.object({ role: z.string() }),
    body: z.object({ version: z.number().int().nonnegative(), permissionCodes: z.array(z.string().min(1).max(150)) }).strict(),
  })), async (request, response, next) => {
    try { sendSuccess(response, { data: await service.replace({ ...request.validated.body, role: request.validated.params.role, actorUserId: request.auth.user.id }) }); } catch (error) { next(error); }
  });
  return router;
}
