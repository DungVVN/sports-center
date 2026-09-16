import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../shared/http/response.js";
import { validateRequest } from "../../shared/validation/validate-request.js";
const id = z.string().uuid();
export function createPaymentRouter(service, authService) { const router = Router(); const read = [authenticate(authService), requirePermission("payment.read")]; const secure = [authenticate(authService), requirePermission("payment.record")]; const payload = z.object({ memberId: id, membershipId: id.optional(), amountVnd: z.coerce.number().int().positive(), method: z.enum(["cash", "online"]).optional(), provider: z.enum(["vnpay", "momo", "zalopay"]).optional(), notes: z.string().trim().max(500).optional() }).strict().superRefine((value, context) => { if (value.method === "online" && !value.provider) context.addIssue({ code: "custom", path: ["provider"], message: "Cần chọn cổng thanh toán." }); });
  router.get("/members/me/payments", authenticate(authService), async (req, res, next) => { try { sendSuccess(res, { data: await service.ownPayments(req.auth.user) }); } catch (error) { next(error); } });
  router.get("/payments", ...read, async (req, res, next) => { try { sendSuccess(res, { data: await service.list(req.query.memberId ? { member_id: req.query.memberId } : undefined) }); } catch (error) { next(error); } });
  router.post("/payments", ...secure, validateRequest(z.object({ body: payload })), async (req, res, next) => { try { sendSuccess(res, { statusCode: 201, data: await service.create(req.validated.body, req.auth.user.id) }); } catch (error) { next(error); } });
  router.get("/payments/:id", ...read, validateRequest(z.object({ params: z.object({ id }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.get(req.validated.params.id) }); } catch (error) { next(error); } });
  router.post("/payments/:id/confirm", ...secure, validateRequest(z.object({ params: z.object({ id }), body: z.object({ status: z.enum(["paid", "failed"]) }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.confirm(req.validated.params.id, req.validated.body.status, req.auth.user.id) }); } catch (error) { next(error); } });
  router.post("/payments/callbacks/:provider", validateRequest(z.object({ params: z.object({ provider: z.enum(["vnpay", "momo", "zalopay"]) }), body: z.object({ transactionCode: z.string().min(1), status: z.enum(["paid", "failed"]), amount: z.coerce.number().int().positive(), signature: z.string().min(1) }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.providerCallback(req.validated.params.provider, req.validated.body) }); } catch (error) { next(error); } });
  return router;
}
