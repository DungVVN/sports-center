import { Router } from "express";
import { authenticate, requirePermission } from "../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../shared/http/response.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function createAuditRouter(service, authService) {
  const router = Router();

  router.get("/audit-logs", authenticate(authService), requirePermission("audit.read"), async (req, res, next) => {
    try {
      const page = positiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
      const pageSize = positiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
      sendSuccess(res, { data: await service.list({ page, pageSize }) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
