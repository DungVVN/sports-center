import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../shared/http/response.js";
import { validateRequest } from "../../shared/validation/validate-request.js";

const id = z.string().uuid();

export function createBookingRouter(service, authService) {
  const router = Router();
  const secure = [authenticate(authService), requirePermission("booking.write")];
  router.get("/bookings", ...secure, validateRequest(z.object({ query: z.object({ memberId: id.optional() }) })), async (req, res, next) => {
    try { sendSuccess(res, { data: await service.list(req.validated.query.memberId, req.auth.user) }); } catch (error) { next(error); }
  });
  router.post("/bookings", ...secure, validateRequest(z.object({ body: z.object({ memberId: id.optional(), classId: id }) })), async (req, res, next) => {
    try { sendSuccess(res, { statusCode: 201, data: await service.create(req.validated.body, req.auth.user) }); } catch (error) { next(error); }
  });
  router.patch("/bookings/:id/cancel", ...secure, validateRequest(z.object({ params: z.object({ id }), body: z.object({ reason: z.string().min(3).max(500) }) })), async (req, res, next) => {
    try { sendSuccess(res, { data: await service.cancel(req.validated.params.id, req.validated.body.reason, req.auth.user) }); } catch (error) { next(error); }
  });
  return router;
}
