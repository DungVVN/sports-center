import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  requirePermission,
} from "../../../shared/auth/authentication.middleware.js";
import { handleServiceRequest } from "../../../shared/http/service-handler.js";
import { validateRequest } from "../../../shared/validation/validate-request.js";
const uuid = z.string().uuid();
const params = z.object({
  id: uuid,
});
const price = z
  .string()
  .regex(/^\d+$/)
  .refine((value) => BigInt(value) <= 1000000000000n, "Giá vượt giới hạn.");
const session = z.object({
  name: z.string().min(2).max(120).optional(),
  coachUserId: uuid,
  roomId: uuid,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});
export function createCourseRouter(service, authService) {
  const router = Router();
  router.get(
    "/public/courses",
    handleServiceRequest(() => service.publicCatalog()),
  );
  const read = [authenticate(authService), requirePermission("course.read")];
  const manage = [
    authenticate(authService),
    requirePermission("course.manage"),
  ];
  const enroll = [
    authenticate(authService),
    requirePermission("course.enroll"),
  ];
  const enrollmentRead = [
    authenticate(authService),
    requirePermission("course.enrollment.read"),
  ];
  router.get(
    "/courses",
    ...read,
    handleServiceRequest((req) => service.list(req.auth.user)),
  );
  router.post(
    "/courses",
    ...manage,
    validateRequest(
      z.object({
        body: z.object({
          name: z.string().min(2).max(120),
          description: z.string().max(1000).optional(),
          priceVnd: price,
          capacity: z.number().int().min(1).max(500),
          paymentHoldMinutes: z.number().int().min(5).max(1440).optional(),
        }),
      }),
    ),
    handleServiceRequest(
      (req) => service.create(req.validated.body, req.auth.user),
      201,
    ),
  );
  router.post(
    "/courses/:id/sessions",
    ...manage,
    validateRequest(
      z.object({
        params,
        body: session,
      }),
    ),
    handleServiceRequest(
      (req) =>
        service.addSession(
          req.validated.params.id,
          req.validated.body,
          req.auth.user,
        ),
      201,
    ),
  );
  router.post(
    "/courses/:id/publish",
    ...manage,
    validateRequest(
      z.object({
        params,
      }),
    ),
    handleServiceRequest((req) =>
      service.publish(req.validated.params.id, req.auth.user),
    ),
  );
  router.post(
    "/courses/:id/complete",
    ...manage,
    validateRequest(
      z.object({
        params,
      }),
    ),
    handleServiceRequest((req) =>
      service.complete(req.validated.params.id, req.auth.user),
    ),
  );
  router.get(
    "/course-enrollments/me",
    ...enroll,
    handleServiceRequest((req) => service.mine(req.auth.user)),
  );
  router.get(
    "/course-enrollments",
    ...enrollmentRead,
    handleServiceRequest(() => service.enrollments()),
  );
  router.post(
    "/courses/:id/enroll",
    ...enroll,
    validateRequest(
      z.object({
        params,
      }),
    ),
    handleServiceRequest(
      (req) => service.enroll(req.validated.params.id, req.auth.user),
      201,
    ),
  );
  router.post(
    "/course-enrollments/:id/cancel",
    ...enroll,
    validateRequest(
      z.object({
        params,
      }),
    ),
    handleServiceRequest((req) =>
      service.cancel(req.validated.params.id, req.auth.user),
    ),
  );
  router.post(
    "/course-enrollments/:id/payment",
    ...enroll,
    validateRequest(
      z.object({
        params,
        body: z.object({
          method: z.enum(["bank_transfer", "online"]),
        }),
      }),
    ),
    handleServiceRequest(
      (req) =>
        service.payment(
          req.validated.params.id,
          req.validated.body,
          req.auth.user,
        ),
      201,
    ),
  );
  return router;
}
