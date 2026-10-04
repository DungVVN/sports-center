import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../../shared/auth/authentication.middleware.js";
import { validateRequest } from "../../../shared/validation/validate-request.js";
import { handleServiceRequest } from "../../../shared/http/service-handler.js";
import { personalizationOperations, personalizationSchemas } from "../domain/personalization-contract.js";

export function createPersonalizationRouter(service, authService) {
  const router = Router();
  for (const [method, path, permission, operation, schema] of personalizationOperations) {
    const hasId = path.includes(":id");
    const validation = z.object({ ...(hasId ? { params: z.object({ id: z.string().uuid() }) } : {}), ...(schema ? { body: personalizationSchemas[schema] } : {}) });
    router[method](path, authenticate(authService), requirePermission(permission), validateRequest(validation), handleServiceRequest((req) => {
      const actor = req.auth.user;
      if (hasId) return operation === "profile" ? service[operation](req.validated.params.id, actor) : service[operation](req.validated.params.id, req.validated.body ?? {}, actor);
      return schema ? service[operation](req.validated.body, actor) : service[operation](actor);
    }, method === "post" && !["reviewAssessment", "approveProtocol", "approveDecision", "reviewCheckin", "withdrawConsent", "revokeAuthorization", "retireProtocol"].includes(operation) ? 201 : 200));
  }
  return router;
}
