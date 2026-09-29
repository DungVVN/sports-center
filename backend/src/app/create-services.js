import { authRepository } from "../modules/auth/auth.repository.js";
import { createAuthService } from "../modules/auth/auth.service.js";
import { verificationDeliveryService } from "../modules/auth/verification-delivery.service.js";
import { staffRepository } from "../modules/staff/staff.repository.js";
import { createStaffService } from "../modules/staff/staff.service.js";
import { memberRepository } from "../modules/members/member.repository.js";
import { createMemberService } from "../modules/members/member.service.js";
import { membershipRepository } from "../modules/memberships/membership.repository.js";
import { createMembershipService } from "../modules/memberships/membership.service.js";
import { classRepository } from "../modules/classes/class.repository.js";
import { createClassService } from "../modules/classes/class.service.js";
import { bookingRepository } from "../modules/bookings/booking.repository.js";
import { createBookingService } from "../modules/bookings/booking.service.js";
import { attendanceRepository } from "../modules/attendance/attendance.repository.js";
import { createAttendanceService } from "../modules/attendance/attendance.service.js";
import { paymentRepository } from "../modules/payments/payment.repository.js";
import { createPaymentService } from "../modules/payments/payment.service.js";
import { supportRepository, createSupportService } from "../modules/support/index.js";
import { notificationPreferenceRepository, notificationPublisher, createNotificationPreferenceService } from "../modules/notifications/index.js";
import { aiAssistRepository } from "../modules/ai-assist/ai-assist.repository.js";
import { createAiAssistService } from "../modules/ai-assist/ai-assist.service.js";
import { trainingRepository } from "../modules/training/training.repository.js";
import { createTrainingService } from "../modules/training/training.service.js";
import { insightRepository } from "../modules/insights/insight.repository.js";
import { createInsightService } from "../modules/insights/insight.service.js";
import { auditRepository } from "../modules/audit/audit.repository.js";
import { createAuditLogService } from "../modules/audit/audit.service.js";
import { assignmentRepository } from "../modules/assignments/assignment.repository.js";
import { createAssignmentService } from "../modules/assignments/assignment.service.js";
import { rolePermissionRepository } from "../modules/role-permissions/role-permission.repository.js";
import { createRolePermissionService } from "../modules/role-permissions/role-permission.service.js";
import { facilityRepository } from "../modules/facilities/facility.repository.js";
import { createFacilityService } from "../modules/facilities/facility.service.js";
import { auditService } from "../shared/audit/audit.service.js";

export function createServices({
  authService = createAuthService({ repository: authRepository, verificationDelivery: verificationDeliveryService, auditService }),
  staffService = createStaffService({ repository: staffRepository, auditService }),
  memberService = createMemberService({ repository: memberRepository, auditService }),
  membershipService = createMembershipService({ repository: membershipRepository, auditService }),
  classService = createClassService({ repository: classRepository, auditService }),
  bookingService = createBookingService({ repository: bookingRepository, auditService }),
  facilityService = createFacilityService({ repository: facilityRepository, auditService }),
  attendanceService = createAttendanceService({ repository: attendanceRepository, auditService }),
  paymentService = createPaymentService({ repository: paymentRepository, auditService }),
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
