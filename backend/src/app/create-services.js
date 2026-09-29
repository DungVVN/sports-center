import { authRepository } from "../modules/auth/index.js";
import { createAuthService } from "../modules/auth/index.js";
import { verificationDeliveryService } from "../modules/auth/index.js";
import { staffRepository } from "../modules/staff/index.js";
import { createStaffService } from "../modules/staff/index.js";
import { staffCredentialsDeliveryService } from "../modules/staff/index.js";
import { memberRepository } from "../modules/members/index.js";
import { createMemberService } from "../modules/members/index.js";
import { membershipRepository } from "../modules/memberships/index.js";
import { createMembershipService } from "../modules/memberships/index.js";
import { classRepository } from "../modules/classes/index.js";
import { createClassService } from "../modules/classes/index.js";
import { bookingRepository } from "../modules/bookings/index.js";
import { createBookingService } from "../modules/bookings/index.js";
import { attendanceRepository } from "../modules/attendance/index.js";
import { createAttendanceService } from "../modules/attendance/index.js";
import { paymentRepository } from "../modules/payments/index.js";
import { createPaymentService } from "../modules/payments/index.js";
import { createPayosPaymentLink, verifyPayosWebhook } from "../modules/payments/index.js";
import { supportRepository, createSupportService } from "../modules/support/index.js";
import { notificationPreferenceRepository, notificationPublisher, createNotificationPreferenceService } from "../modules/notifications/index.js";
import { aiAssistRepository, createAiAssistService } from "../modules/ai-assist/index.js";
import { trainingRepository } from "../modules/training/index.js";
import { createTrainingService } from "../modules/training/index.js";
import { insightRepository, createInsightService } from "../modules/insights/index.js";
import { auditRepository, createAuditLogService } from "../modules/audit/index.js";
import { assignmentRepository } from "../modules/assignments/index.js";
import { createAssignmentService } from "../modules/assignments/index.js";
import { rolePermissionRepository, createRolePermissionService } from "../modules/role-permissions/index.js";
import { facilityRepository } from "../modules/facilities/index.js";
import { createFacilityService } from "../modules/facilities/index.js";
import { auditService } from "../shared/audit/audit.service.js";

export function createServices({
  authService = createAuthService({ repository: authRepository, verificationDelivery: verificationDeliveryService, auditService }),
  staffService = createStaffService({ repository: staffRepository, auditService, credentialsDelivery: staffCredentialsDeliveryService }),
  memberService = createMemberService({ repository: memberRepository, auditService, credentialsDelivery: staffCredentialsDeliveryService }),
  membershipService = createMembershipService({ repository: membershipRepository, auditService }),
  classService = createClassService({ repository: classRepository, auditService }),
  bookingService = createBookingService({ repository: bookingRepository, auditService }),
  facilityService = createFacilityService({ repository: facilityRepository, auditService }),
  attendanceService = createAttendanceService({ repository: attendanceRepository, auditService }),
  paymentService = createPaymentService({ repository: paymentRepository, auditService, payosGateway: { createPaymentLink: createPayosPaymentLink, verifyWebhook: verifyPayosWebhook } }),
  supportService = createSupportService({ repository: supportRepository, auditService, memberDirectory: memberRepository, notificationPublisher }),
  notificationPreferenceService = createNotificationPreferenceService({ repository: notificationPreferenceRepository }),
  aiAssistService = createAiAssistService({ repository: aiAssistRepository, auditService }),
  trainingService = createTrainingService({ repository: trainingRepository, auditService }),
  insightService = createInsightService({ repository: insightRepository }),
  assignmentService = createAssignmentService({ repository: assignmentRepository, auditService }),
  auditLogService = createAuditLogService({ repository: auditRepository }),
  rolePermissionService = createRolePermissionService({ repository: rolePermissionRepository }),
} = {}) {
  return { authService, staffService, memberService, membershipService, classService, bookingService, facilityService, attendanceService, paymentService, supportService, notificationPreferenceService, aiAssistService, trainingService, insightService, assignmentService, auditLogService, rolePermissionService };
}
