import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../../shared/http/response.js";
import { validateRequest } from "../../../shared/validation/validate-request.js";
const deliverySchema = z.object({
  body: z.object({
    memberId: z.string().uuid(),
    subject: z.string().trim().min(3).max(160),
    body: z.string().trim().min(3).max(1000),
  }),
});

export function createAiAssistRouter(service, authService) {
  const router = Router();
  const auth = authenticate(authService);

  router.get("/ai-assist/suggestions", auth, requirePermission("ai.assist.read"), async (req, res, next) => {
    try {
      sendSuccess(res, { data: await service.suggestions(req.auth.user) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/ai-assist/deliveries", auth, requirePermission("ai.assist.deliver"), validateRequest(deliverySchema), async (req, res, next) => {
    try {
      sendSuccess(res, { statusCode: 201, data: await service.deliver(req.validated.body, req.auth.user) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
