import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { authRepository } from "./modules/auth/auth.repository.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createAuthService } from "./modules/auth/auth.service.js";
import { verificationDeliveryService } from "./modules/auth/verification-delivery.service.js";
import { staffRepository } from "./modules/staff/staff.repository.js";
import { createStaffRouter } from "./modules/staff/staff.routes.js";
import { createStaffService } from "./modules/staff/staff.service.js";
import { memberRepository } from "./modules/members/member.repository.js";
import { createMemberRouter } from "./modules/members/member.routes.js";
import { createMemberService } from "./modules/members/member.service.js";
import { membershipRepository } from "./modules/memberships/membership.repository.js";
import { createMembershipRouter } from "./modules/memberships/membership.routes.js";
import { createMembershipService } from "./modules/memberships/membership.service.js";
import { classRepository } from "./modules/classes/class.repository.js";
import { createClassRouter } from "./modules/classes/class.routes.js";
import { createClassService } from "./modules/classes/class.service.js";
import { bookingRepository } from "./modules/bookings/booking.repository.js";
import { createBookingRouter } from "./modules/bookings/booking.routes.js";
import { createBookingService } from "./modules/bookings/booking.service.js";
import { attendanceRepository } from "./modules/attendance/attendance.repository.js";
import { createAttendanceRouter } from "./modules/attendance/attendance.routes.js";
import { createAttendanceService } from "./modules/attendance/attendance.service.js";
import { paymentRepository } from "./modules/payments/payment.repository.js";
import { createPaymentRouter } from "./modules/payments/payment.routes.js";
import { createPaymentService } from "./modules/payments/payment.service.js";
import { supportRepository } from "./modules/support/support.repository.js";
import { createSupportRouter } from "./modules/support/support.routes.js";
import { createSupportService } from "./modules/support/support.service.js";
import { trainingRepository } from "./modules/training/training.repository.js";
import { createTrainingRouter } from "./modules/training/training.routes.js";
import { createTrainingService } from "./modules/training/training.service.js";
import { insightRepository } from "./modules/insights/insight.repository.js";
import { createInsightRouter } from "./modules/insights/insight.routes.js";
import { createInsightService } from "./modules/insights/insight.service.js";
import { createAuditRouter } from "./modules/audit/audit.routes.js";
import { auditRepository } from "./modules/audit/audit.repository.js";
import { createAuditLogService } from "./modules/audit/audit.service.js";
import { createAssignmentRouter } from "./modules/assignments/assignment.routes.js";
import { assignmentRepository } from "./modules/assignments/assignment.repository.js";
import { createAssignmentService } from "./modules/assignments/assignment.service.js";
import { auditService } from "./shared/audit/audit.service.js";
import { openApiSpec } from "./openapi/spec.js";
import { sendSuccess } from "./shared/http/response.js";
import { errorHandler } from "./shared/middleware/error-handler.js";
import { notFound } from "./shared/middleware/not-found.js";
import { requestId } from "./shared/middleware/request-id.js";
import { requireTrustedOrigin } from "./shared/security/trusted-origin.middleware.js";

function isAllowedOrigin(origin) {
  return !origin || env.corsOrigins.includes(origin);
}

export function createApp({ authService = createAuthService({ repository: authRepository, verificationDelivery: verificationDeliveryService, auditService }), staffService = createStaffService({ repository: staffRepository, auditService }), memberService = createMemberService({ repository: memberRepository, auditService }), membershipService = createMembershipService({ repository: membershipRepository, auditService }), classService = createClassService({ repository: classRepository, auditService }), bookingService = createBookingService({ repository: bookingRepository, auditService }), attendanceService = createAttendanceService({ repository: attendanceRepository, auditService }), paymentService = createPaymentService({ repository: paymentRepository, auditService }), supportService = createSupportService({ repository: supportRepository, auditService }), trainingService = createTrainingService({ repository: trainingRepository, auditService }), insightService = createInsightService({ repository: insightRepository }), assignmentService = createAssignmentService({ repository: assignmentRepository, auditService }), auditLogService = createAuditLogService({ repository: auditRepository }) } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb", verify: (request, response, buffer) => { request.rawBody = buffer; } }));
  app.use(requestId);
  app.use(requireTrustedOrigin);

  app.get(`${env.apiBasePath}/health`, (request, response) => sendSuccess(response, {
    data: { status: "ok", requestId: request.id },
  }));
  app.get("/openapi.json", (request, response) => response.json(openApiSpec));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, { explorer: true }));
  app.use(`${env.apiBasePath}/auth`, createAuthRouter(authService));
  app.use(`${env.apiBasePath}/staff`, createStaffRouter(staffService, authService));
  app.use(`${env.apiBasePath}/members`, createMemberRouter(memberService, authService));
  app.use(env.apiBasePath, createMembershipRouter(membershipService, authService));
  app.use(env.apiBasePath, createClassRouter(classService, authService));
  app.use(env.apiBasePath, createBookingRouter(bookingService, authService));
  app.use(env.apiBasePath, createAttendanceRouter(attendanceService, authService));
  app.use(env.apiBasePath, createPaymentRouter(paymentService, authService));
  app.use(env.apiBasePath, createSupportRouter(supportService, authService));
  app.use(env.apiBasePath, createTrainingRouter(trainingService, authService));
  app.use(env.apiBasePath, createInsightRouter(insightService, authService));
  app.use(env.apiBasePath, createAuditRouter(auditLogService, authService));
  app.use(env.apiBasePath, createAssignmentRouter(assignmentService, authService));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
