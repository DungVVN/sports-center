// Only permissions enforced by a mounted API appear as configurable functions.
export const assignablePermissionCodes = Object.freeze([
  "ai.assist.deliver", "ai.assist.read", "attendance.read", "attendance.self.read", "attendance.write",
  "audit.read", "booking.read", "booking.write", "class.change.request", "class.change.review",
  "class.manage", "class.read", "member.read", "member.write", "member.credentials.reset", "membership.assign",
  "membership.freeze.request", "membership.freeze.review", "membership.package.manage", "membership.package.read",
  "membership.self.read", "notification.preference.manage", "payment.read", "payment.record", "payment.self.read",
  "registration.approve", "report.read", "staff.manage", "support.ticket.create", "support.ticket.read",
  "support.ticket.respond", "training.self.read", "training.template.manage", "training.write",
  "facility.manage", "facility.day.manage", "facility.booking.self.read", "facility.booking.request",
  "facility.booking.read", "facility.booking.approve", "facility.booking.cancel",
]);

export const permissionDependencies = Object.freeze({
  "member.write": ["member.read"],
  "member.credentials.reset": ["member.read"],
  "class.manage": ["class.read"],
  "class.change.request": ["class.read"],
  "class.change.review": ["class.read"],
  "booking.read": ["class.read"],
  "booking.write": ["booking.read"],
  "attendance.read": ["class.read", "booking.read"],
  "attendance.write": ["attendance.read"],
  "payment.record": ["payment.read", "member.read", "membership.package.read"],
  "membership.assign": ["member.read", "membership.package.read"],
  "membership.package.manage": ["membership.package.read"],
  "membership.freeze.review": ["membership.package.read", "member.read"],
  "support.ticket.create": ["support.ticket.read"],
  "support.ticket.respond": ["support.ticket.read"],
  "training.template.manage": ["training.write"],
  "ai.assist.read": ["training.write"],
  "ai.assist.deliver": ["ai.assist.read"],
  "facility.booking.request": ["facility.booking.self.read"],
  "facility.booking.approve": ["facility.booking.read"],
  "facility.booking.cancel": ["facility.booking.read"],
});

// These APIs require a member profile and cannot operate for staff accounts.
export const permissionRoleScopes = Object.freeze({
  "member.credentials.reset": ["manager", "receptionist", "coach"],
  "attendance.self.read": ["member"],
  "membership.self.read": ["member"],
  "payment.self.read": ["member"],
  "training.self.read": ["coach", "member"],
  "support.ticket.create": ["member"],
  "membership.freeze.request": ["member"],
  "support.ticket.respond": ["manager", "receptionist", "coach"],
});

// Staff booking form selects a member from the directory; Member books for self.
export const permissionRoleDependencies = Object.freeze({
  "booking.write": Object.freeze({ manager: ["member.read"], receptionist: ["member.read"], coach: ["member.read"] }),
});
