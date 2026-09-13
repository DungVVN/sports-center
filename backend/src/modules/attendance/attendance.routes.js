import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../shared/http/response.js";
import { validateRequest } from "../../shared/validation/validate-request.js";

const id = z.string().uuid();
export function createAttendanceRouter(service, authService) {
  const router = Router();
  const secure = [authenticate(authService), requirePermission("attendance.write")];
  router.get("/members/me/attendance", authenticate(authService), async (req, res, next) => { try { sendSuccess(res, { data: await service.ownRecords(req.auth.user) }); } catch (error) { next(error); } });
  router.get("/classes/:id/attendance", ...secure, validateRequest(z.object({ params: z.object({ id }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.list(req.validated.params.id, req.auth.user) }); } catch (error) { next(error); } });
  router.post("/attendance/check-in", ...secure, validateRequest(z.object({ body: z.object({ bookingId: id }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.checkIn(req.validated.body.bookingId, req.auth.user) }); } catch (error) { next(error); } });
  router.post("/attendance/:id/check-out", ...secure, validateRequest(z.object({ params: z.object({ id }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.checkOut(req.validated.params.id, req.auth.user) }); } catch (error) { next(error); } });
  router.post("/attendance/:id/corrections", ...secure, validateRequest(z.object({ params: z.object({ id }), body: z.object({ status: z.enum(["present", "absent", "late", "not_marked"]), reason: z.string().min(3).max(500) }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.correct(req.validated.params.id, req.validated.body.status, req.validated.body.reason, req.auth.user) }); } catch (error) { next(error); } });
  return router;
}
