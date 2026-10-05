import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../../shared/http/response.js";
import { validateRequest } from "../../../shared/validation/validate-request.js";

const id = z.string().uuid();
export function createSupportRouter(service, authService) {
  const router = Router();
  const auth = authenticate(authService);
  router.get("/support-tickets", auth, requirePermission("support.ticket.read"), async (req, res, next) => {
    try {
      sendSuccess(res, { data: await service.list(req.auth.user) });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    "/support-tickets",
    auth,
    requirePermission("support.ticket.create"),
    validateRequest(
      z.object({
        body: z.object({
          subject: z.string().trim().min(3).max(200),
          body: z.string().trim().min(3).max(5000),
          priority: z.enum(["low", "normal", "high"]).optional(),
        }),
      }),
    ),
    async (req, res, next) => {
      try {
        sendSuccess(res, { statusCode: 201, data: await service.create(req.validated.body, req.auth.user) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    "/support-tickets/:id",
    auth,
    requirePermission("support.ticket.read"),
    validateRequest(z.object({ params: z.object({ id }) })),
    async (req, res, next) => {
      try {
        sendSuccess(res, { data: await service.detail(req.validated.params.id, req.auth.user) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/support-tickets/:id/assign-self",
    auth,
    requirePermission("support.ticket.respond"),
    validateRequest(z.object({ params: z.object({ id }) })),
    async (req, res, next) => {
      try {
        sendSuccess(res, { data: await service.assignSelf(req.validated.params.id, req.auth.user) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/support-tickets/:id/responses",
    auth,
    requirePermission("support.ticket.respond"),
    validateRequest(
      z.object({
        params: z.object({ id }),
        body: z.object({
          body: z.string().trim().min(1).max(5000),
          status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
        }),
      }),
    ),
    async (req, res, next) => {
      try {
        sendSuccess(res, { data: await service.respond(req.validated.params.id, req.validated.body, req.auth.user) });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
