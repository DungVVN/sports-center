import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../shared/http/response.js";
import { validateRequest } from "../../shared/validation/validate-request.js";

const id = z.string().uuid();
const base = z.object({ name: z.string().min(2).max(120), type: z.string().min(2).max(60), description: z.string().max(1000).optional(), coachUserId: id, roomId: id, startsAt: z.string().datetime(), endsAt: z.string().datetime(), capacity: z.number().int().min(1).max(500) });
export function createClassRouter(service, authService) { const router = Router(); const read = [authenticate(authService), requirePermission("class.read")]; const manage = [authenticate(authService), requirePermission("class.manage")]; const review = [authenticate(authService), requirePermission("class.change.review")];
  router.get("/class-change-requests", ...review, validateRequest(z.object({ query: z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.changes(req.validated.query.status) }); } catch (error) { next(error); } });
  router.get("/classes", ...read, async (req, res, next) => { try { sendSuccess(res, { data: await service.list(req.auth.user) }); } catch (error) { next(error); } });
  router.get("/rooms", ...read, async (req, res, next) => { try { sendSuccess(res, { data: await service.rooms() }); } catch (error) { next(error); } });
  router.get("/coaches", ...read, async (req, res, next) => { try { sendSuccess(res, { data: await service.coaches(req.auth.user) }); } catch (error) { next(error); } });
  router.post("/classes", ...manage, validateRequest(z.object({ body: base })), async (req, res, next) => { try { sendSuccess(res, { statusCode: 201, data: await service.create(req.validated.body, req.auth.user.id) }); } catch (error) { next(error); } });
  router.patch("/classes/:id", ...manage, validateRequest(z.object({ params: z.object({ id }), body: base.partial() })), async (req, res, next) => { try { sendSuccess(res, { data: await service.update(req.validated.params.id, req.validated.body, req.auth.user.id) }); } catch (error) { next(error); } });
  router.post("/classes/:id/publish", ...manage, validateRequest(z.object({ params: z.object({ id }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.publish(req.validated.params.id, req.auth.user.id) }); } catch (error) { next(error); } });
  router.post("/classes/:id/change-requests", ...read, validateRequest(z.object({ params: z.object({ id }), body: z.object({ type: z.enum(["cancel", "reschedule"]), startsAt: z.string().datetime().optional(), endsAt: z.string().datetime().optional(), reason: z.string().min(3).max(500) }).superRefine((value, context) => { if (value.type === "reschedule" && (!value.startsAt || !value.endsAt)) context.addIssue({ code: "custom", message: "Đổi lịch cần giờ bắt đầu và kết thúc." }); }) })), async (req, res, next) => { try { sendSuccess(res, { statusCode: 201, data: await service.requestChange(req.validated.params.id, req.validated.body, req.auth.user.id) }); } catch (error) { next(error); } });
  router.patch("/class-change-requests/:id", ...review, validateRequest(z.object({ params: z.object({ id }), body: z.object({ approved: z.boolean() }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.reviewChange(req.validated.params.id, req.validated.body.approved, req.auth.user.id) }); } catch (error) { next(error); } });
  return router;
}
