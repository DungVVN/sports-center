import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../../shared/http/response.js";
import { validateRequest } from "../../../shared/validation/validate-request.js";
const preferenceSchema = z.object({ body: z.object({ emailEnabled: z.boolean() }) });

export function createNotificationPreferenceRouter(service, authService) {
  const router = Router();
  const auth = authenticate(authService);
  const managePreference = requirePermission("notification.preference.manage");

  router.get("/notification-preferences", auth, managePreference, async (req, res, next) => {
    try {
      sendSuccess(res, { data: await service.get(req.auth.user) });
    } catch (error) {
      next(error);
    }
  });

  router.put("/notification-preferences", auth, managePreference, validateRequest(preferenceSchema), async (req, res, next) => {
    try {
      sendSuccess(res, { data: await service.save(req.validated.body, req.auth.user) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
