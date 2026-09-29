import { createAuthRouter } from "../modules/auth/auth.routes.js";
import { createStaffRouter } from "../modules/staff/staff.routes.js";
import { createMemberRouter } from "../modules/members/member.routes.js";
import { createMembershipRouter } from "../modules/memberships/membership.routes.js";
import { createClassRouter } from "../modules/classes/class.routes.js";
import { createBookingRouter } from "../modules/bookings/booking.routes.js";
import { createFacilityRouter } from "../modules/facilities/facility.routes.js";
import { createAttendanceRouter } from "../modules/attendance/attendance.routes.js";
import { createPaymentRouter } from "../modules/payments/payment.routes.js";
import { createSupportRouter } from "../modules/support/index.js";
import { createNotificationPreferenceRouter } from "../modules/notifications/index.js";
import { createAiAssistRouter } from "../modules/ai-assist/ai-assist.routes.js";
import { createTrainingRouter } from "../modules/training/training.routes.js";
import { createInsightRouter } from "../modules/insights/insight.routes.js";
import { createAuditRouter } from "../modules/audit/audit.routes.js";
import { createAssignmentRouter } from "../modules/assignments/assignment.routes.js";
import { createRolePermissionRouter } from "../modules/role-permissions/role-permission.routes.js";

export function registerRoutes(app, apiBasePath, {
  authService, staffService, memberService, membershipService, classService, bookingService,
  facilityService, attendanceService, paymentService, supportService, notificationPreferenceService,
  aiAssistService, trainingService, insightService, auditLogService, assignmentService, rolePermissionService,
}) {
  app.use(`${apiBasePath}/auth`, createAuthRouter(authService));
  app.use(`${apiBasePath}/staff`, createStaffRouter(staffService, authService));
  app.use(`${apiBasePath}/members`, createMemberRouter(memberService, authService));
  app.use(apiBasePath, createMembershipRouter(membershipService, authService));
  app.use(apiBasePath, createClassRouter(classService, authService));
  app.use(apiBasePath, createBookingRouter(bookingService, authService));
  app.use(apiBasePath, createFacilityRouter(facilityService, authService));
  app.use(apiBasePath, createAttendanceRouter(attendanceService, authService));
  app.use(apiBasePath, createPaymentRouter(paymentService, authService));
  app.use(apiBasePath, createSupportRouter(supportService, authService));
  app.use(apiBasePath, createNotificationPreferenceRouter(notificationPreferenceService, authService));
  app.use(apiBasePath, createAiAssistRouter(aiAssistService, authService));
  app.use(apiBasePath, createTrainingRouter(trainingService, authService));
  app.use(apiBasePath, createInsightRouter(insightService, authService));
  app.use(apiBasePath, createAuditRouter(auditLogService, authService));
  app.use(apiBasePath, createAssignmentRouter(assignmentService, authService));
  app.use(apiBasePath, createRolePermissionRouter(rolePermissionService, authService));
}
