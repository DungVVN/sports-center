import { createAuthRouter } from "../modules/auth/index.js";
import { createStaffRouter } from "../modules/staff/index.js";
import { createMemberRouter } from "../modules/members/index.js";
import { createMembershipRouter } from "../modules/memberships/index.js";
import { createClassRouter } from "../modules/classes/index.js";
import { createBookingRouter } from "../modules/bookings/index.js";
import { createFacilityRouter } from "../modules/facilities/index.js";
import { createAttendanceRouter } from "../modules/attendance/index.js";
import { createPaymentRouter } from "../modules/payments/index.js";
import { createSupportRouter } from "../modules/support/index.js";
import { createNotificationPreferenceRouter } from "../modules/notifications/index.js";
import { createAiAssistRouter } from "../modules/ai-assist/index.js";
import { createTrainingRouter } from "../modules/training/index.js";
import { createInsightRouter } from "../modules/insights/index.js";
import { createAuditRouter } from "../modules/audit/index.js";
import { createAssignmentRouter } from "../modules/assignments/index.js";
import { createRolePermissionRouter } from "../modules/role-permissions/index.js";

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
