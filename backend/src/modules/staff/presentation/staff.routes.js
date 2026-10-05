import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../../shared/errors/app-error.js";
import { authenticate, requirePermission } from "../../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../../shared/http/response.js";
import { validateRequest } from "../../../shared/validation/validate-request.js";

const id = z.string().uuid();
const base = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(9).max(20).optional(),
  dateOfBirth: z.string().date().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  role: z.enum(["manager", "receptionist", "coach"]).optional(),
  specialties: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
});
export function createStaffRouter(service, authService) {
  const router = Router();
  const secure = [authenticate(authService), requirePermission("staff.manage")];
  const adminOnly = (req, _res, next) =>
    req.auth.user.role === "admin"
      ? next()
      : next(
          new AppError({
            statusCode: 403,
            code: "ADMIN_REQUIRED",
            message: "Chỉ Admin được cấp lại mật khẩu nhân sự.",
          }),
        );
  router.get("/", ...secure, async (req, res, next) => {
    try {
      sendSuccess(res, { data: await service.list() });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    "/",
    ...secure,
    validateRequest(
      z.object({
        body: base.extend({
          fullName: z.string().trim().min(2).max(120),
          email: z.string().email(),
          phone: z.string().min(9).max(20),
          role: z.enum(["manager", "receptionist", "coach"]),
        }),
      }),
    ),
    async (req, res, next) => {
      try {
        sendSuccess(res, { statusCode: 201, data: await service.create(req.validated.body, req.auth.user.id) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get("/:id", ...secure, validateRequest(z.object({ params: z.object({ id }) })), async (req, res, next) => {
    try {
      sendSuccess(res, { data: await service.get(req.validated.params.id) });
    } catch (error) {
      next(error);
    }
  });
  router.patch(
    "/:id",
    ...secure,
    validateRequest(z.object({ params: z.object({ id }), body: base })),
    async (req, res, next) => {
      try {
        sendSuccess(res, { data: await service.update(req.validated.params.id, req.validated.body, req.auth.user.id) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.patch(
    "/:id/status",
    ...secure,
    validateRequest(
      z.object({ params: z.object({ id }), body: z.object({ status: z.enum(["active", "suspended"]) }) }),
    ),
    async (req, res, next) => {
      try {
        sendSuccess(res, {
          data: await service.setStatus(req.validated.params.id, req.validated.body.status, req.auth.user.id),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/:id/account-credentials",
    ...secure,
    adminOnly,
    validateRequest(z.object({ params: z.object({ id }) })),
    async (req, res, next) => {
      try {
        sendSuccess(res, { data: await service.resetPassword(req.validated.params.id, req.auth.user.id) });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
