import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../shared/http/response.js";
import { validateRequest } from "../../shared/validation/validate-request.js";

const id = z.string().uuid();
const exercise = z.object({ name: z.string().min(1).max(100), sets: z.number().int().positive(), reps: z.number().int().positive().nullable().optional(), duration_seconds: z.number().int().positive().nullable().optional(), rest_seconds: z.number().int().nonnegative(), instructions: z.string().max(500).optional() });

export function createTrainingRouter(service, authService) {
  const router = Router();
  const secure = [authenticate(authService), requirePermission("training.write")];
  const templateManage = [authenticate(authService), requirePermission("training.template.manage")];
  router.get("/training-templates", ...secure, async (req, res, next) => { try { sendSuccess(res, { data: await service.templates() }); } catch (error) { next(error); } });
  router.get("/training-members", ...secure, async (req, res, next) => { try { sendSuccess(res, { data: await service.members(req.auth.user) }); } catch (error) { next(error); } });
  router.post("/training-templates", ...templateManage, validateRequest(z.object({ body: z.object({ name: z.string().min(2), targetGroup: z.string().min(2), description: z.string().max(500).optional(), exercises: z.array(exercise).min(1) }) })), async (req, res, next) => { try { sendSuccess(res, { statusCode: 201, data: await service.createTemplate(req.validated.body, req.auth.user.id) }); } catch (error) { next(error); } });
  router.get("/training-plans", ...secure, async (req, res, next) => { try { sendSuccess(res, { data: await service.plans(req.query.memberId, req.auth.user) }); } catch (error) { next(error); } });
  router.post("/training-plans", ...secure, validateRequest(z.object({ body: z.object({ memberId: id, templateId: id.optional(), name: z.string().min(2), goal: z.string().min(2), startsOn: z.string().date(), endsOn: z.string().date(), exercises: z.array(exercise).optional() }) })), async (req, res, next) => { try { sendSuccess(res, { statusCode: 201, data: await service.createPlan(req.validated.body, req.auth.user) }); } catch (error) { next(error); } });
  router.patch("/training-plans/:id", ...secure, validateRequest(z.object({ params: z.object({ id }), body: z.object({ name: z.string().min(2).optional(), goal: z.string().min(2).optional(), status: z.string().min(2).optional(), exercises: z.array(exercise).optional() }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.updatePlan(req.validated.params.id, req.validated.body, req.auth.user) }); } catch (error) { next(error); } });
  router.post("/training-results", ...secure, validateRequest(z.object({ body: z.object({ planId: id, exerciseId: id.optional(), recordedOn: z.string().date(), valueNumeric: z.number().optional(), valueText: z.string().max(500).optional(), metric: z.string().min(1), coachComment: z.string().max(500).optional() }) })), async (req, res, next) => { try { sendSuccess(res, { statusCode: 201, data: await service.createResult(req.validated.body, req.auth.user) }); } catch (error) { next(error); } });
  router.get("/members/:id/training-results", ...secure, validateRequest(z.object({ params: z.object({ id }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.results(req.validated.params.id, req.auth.user) }); } catch (error) { next(error); } });
  return router;
}
