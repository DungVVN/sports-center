import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../../shared/http/response.js";
import { validateRequest } from "../../../shared/validation/validate-request.js";
import { AppError } from "../../../shared/errors/app-error.js";

const id = z.string().uuid();
const date = z.iso.date();
const minute = z.number().int().min(0).max(1440);
const requestBody = z
  .object({
    dayId: id,
    startMinute: minute,
    endMinute: minute,
    participantCount: z.number().int().min(1).max(100),
    phone: z
      .string()
      .trim()
      .regex(/^(?:\+84|0)\d{9,10}$/),
  })
  .strict()
  .refine((value) => value.endMinute > value.startMinute, { message: "Giờ kết thúc phải sau giờ bắt đầu." });
const guards = {
  "facility.manage": requirePermission("facility.manage"),
  "facility.day.manage": requirePermission("facility.day.manage"),
  "facility.booking.self.read": requirePermission("facility.booking.self.read"),
  "facility.booking.request": requirePermission("facility.booking.request"),
  "facility.booking.read": requirePermission("facility.booking.read"),
  "facility.booking.approve": requirePermission("facility.booking.approve"),
  "facility.booking.cancel": requirePermission("facility.booking.cancel"),
};
const secure = (authService, permission) => [
  authenticate(authService),
  (req, res, next) => {
    if (req.auth.user.role === "member" && ["facility.booking.read", "facility.booking.approve"].includes(permission))
      return next(
        new AppError({
          statusCode: 403,
          code: "FORBIDDEN",
          message: "Hội viên chỉ được xem và hủy đơn đặt sân của bản thân.",
        }),
      );
    return guards[permission](req, res, next);
  },
];

export function createFacilityRouter(service, authService) {
  const router = Router();
  router.get("/facility-settings", ...secure(authService, "facility.manage"), async (req, res, next) => {
    try {
      sendSuccess(res, { data: await service.settings() });
    } catch (error) {
      next(error);
    }
  });
  router.patch(
    "/facilities/:id/configuration",
    ...secure(authService, "facility.manage"),
    validateRequest(
      z.object({
        params: z.object({ id }),
        body: z.object({ hourlyRateVnd: z.string().regex(/^\d{1,12}$/), roomId: id.nullable().optional() }).strict(),
      }),
    ),
    async (req, res, next) => {
      try {
        sendSuccess(res, {
          data: await service.configure(req.validated.params.id, req.validated.body, req.auth.user.id),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/facility-reservations/:id/payment",
    ...secure(authService, "facility.booking.request"),
    validateRequest(
      z.object({ params: z.object({ id }), body: z.object({ method: z.enum(["bank_transfer", "online"]) }).strict() }),
    ),
    async (req, res, next) => {
      try {
        sendSuccess(res, { data: await service.payment(req.validated.params.id, req.validated.body, req.auth.user) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/facility-reservations/:id/complete",
    ...secure(authService, "facility.booking.approve"),
    validateRequest(
      z.object({ params: z.object({ id }), body: z.object({ note: z.string().trim().min(3).max(500) }).strict() }),
    ),
    async (req, res, next) => {
      try {
        sendSuccess(res, {
          data: await service.complete(req.validated.params.id, req.validated.body.note, req.auth.user.id),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    "/public/facility-calendar",
    validateRequest(
      z.object({
        query: z.object({ from: date, to: date, typeId: id.optional() }).refine(
          (value) => {
            const days = (Date.parse(value.to) - Date.parse(value.from)) / 86400000;
            return days >= 0 && days <= 30;
          },
          { message: "Khoảng xem lịch tối đa 31 ngày." },
        ),
      }),
    ),
    async (req, res, next) => {
      try {
        sendSuccess(res, { data: await service.publicCalendar(req.validated.query) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/facility-types",
    ...secure(authService, "facility.manage"),
    validateRequest(z.object({ body: z.object({ name: z.string().trim().min(2).max(80) }).strict() })),
    async (req, res, next) => {
      try {
        sendSuccess(res, {
          statusCode: 201,
          data: await service.createType(req.validated.body.name, req.auth.user.id),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/facilities",
    ...secure(authService, "facility.manage"),
    validateRequest(
      z.object({
        body: z
          .object({ typeId: id, name: z.string().trim().min(2).max(100), openMinute: minute, closeMinute: minute })
          .refine((value) => value.closeMinute > value.openMinute, { message: "Giờ đóng cửa phải sau giờ mở cửa." }),
      }),
    ),
    async (req, res, next) => {
      try {
        sendSuccess(res, { statusCode: 201, data: await service.createFacility(req.validated.body, req.auth.user.id) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/facility-days",
    ...secure(authService, "facility.day.manage"),
    validateRequest(z.object({ body: z.object({ facilityId: id, date }) })),
    async (req, res, next) => {
      try {
        sendSuccess(res, { statusCode: 201, data: await service.createDay(req.validated.body, req.auth.user.id) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    "/facility-reservations/me",
    ...secure(authService, "facility.booking.self.read"),
    async (req, res, next) => {
      try {
        sendSuccess(res, { data: await service.mine(req.auth.user.id) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/facility-reservations",
    ...secure(authService, "facility.booking.request"),
    validateRequest(z.object({ body: requestBody })),
    async (req, res, next) => {
      try {
        sendSuccess(res, { statusCode: 201, data: await service.request(req.validated.body, req.auth.user.id) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get("/facility-reservations", ...secure(authService, "facility.booking.read"), async (req, res, next) => {
    try {
      sendSuccess(res, { data: await service.reservations() });
    } catch (error) {
      next(error);
    }
  });
  router.patch(
    "/facility-reservations/:id/review",
    ...secure(authService, "facility.booking.approve"),
    validateRequest(
      z.object({
        params: z.object({ id }),
        body: z
          .object({
            approved: z.boolean(),
            startMinute: minute.optional(),
            endMinute: minute.optional(),
            reason: z.string().trim().min(3).max(500).optional(),
          })
          .superRefine((value, context) => {
            if (!value.approved && !value.reason)
              context.addIssue({ code: "custom", message: "Cần lý do khi từ chối." });
            if (
              value.startMinute !== undefined &&
              value.endMinute !== undefined &&
              value.endMinute <= value.startMinute
            )
              context.addIssue({ code: "custom", message: "Giờ kết thúc phải sau giờ bắt đầu." });
          }),
      }),
    ),
    async (req, res, next) => {
      try {
        sendSuccess(res, { data: await service.review(req.validated.params.id, req.validated.body, req.auth.user.id) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.patch(
    "/facility-reservations/:id/cancel",
    ...secure(authService, "facility.booking.cancel"),
    validateRequest(
      z.object({ params: z.object({ id }), body: z.object({ reason: z.string().trim().min(3).max(500) }) }),
    ),
    async (req, res, next) => {
      try {
        sendSuccess(res, {
          data: await service.cancel(
            req.validated.params.id,
            req.validated.body.reason,
            req.auth.user.id,
            req.auth.user.role,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.patch(
    "/facility-reservations/:id/cancel/confirm",
    authenticate(authService),
    validateRequest(z.object({ params: z.object({ id }) })),
    async (req, res, next) => {
      try {
        sendSuccess(res, { data: await service.confirmCancellation(req.validated.params.id, req.auth.user.id) });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
