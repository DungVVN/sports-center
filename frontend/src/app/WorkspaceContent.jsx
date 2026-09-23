import { AttendancePage } from "../features/attendance/AttendancePage.jsx";
import { AuditLogsPage } from "../features/dashboard/AuditLogsPage.jsx";
import { DashboardHome } from "../features/dashboard/DashboardHome.jsx";
import { ReportsPage } from "../features/dashboard/ReportsPage.jsx";
import { RegistrationApprovalPage } from "../features/auth/RegistrationApprovalPage.jsx";
import { BookingsPage } from "../features/bookings/BookingsPage.jsx";
import { ClassesPage } from "../features/classes/ClassesPage.jsx";
import { MembersPage } from "../features/members/MembersPage.jsx";
import { MembershipsPage } from "../features/memberships/MembershipsPage.jsx";
import { PaymentsPage } from "../features/payments/PaymentsPage.jsx";
import { StaffPage } from "../features/staff/StaffPage.jsx";
import { TrainingPage } from "../features/training/TrainingPage.jsx";
import { ProfilePage } from "../features/auth/ProfilePage.jsx";
import { SupportStaffPage } from "../features/support/SupportStaffPage.jsx";
import { SupportPage } from "../features/support/SupportPage.jsx";
import { MemberAttendancePage } from "../features/attendance/MemberAttendancePage.jsx";
import { MemberPaymentsPage } from "../features/payments/MemberPaymentsPage.jsx";
import { MemberTrainingPage } from "../features/training/MemberTrainingPage.jsx";
import { RolePermissionPage } from "../features/role-permissions/RolePermissionPage.jsx";
import { FacilityCalendarPage } from "../features/facilities/FacilityCalendarPage.jsx";
import { hasSessionPermission } from "../utils/session-permissions.js";

export function WorkspaceContent({ onNavigate, onProfileSaved, onSessionRevoked, session, view, dashboardRole = "manager" }) {
  const pages = {
    attendance: <AttendancePage session={session} />,
    audit: <AuditLogsPage />,
    bookings: <BookingsPage session={session} />,
    "facility-calendar": <FacilityCalendarPage session={session} />,
    classes: <ClassesPage session={session} />,
    dashboard: <DashboardHome onNavigate={onNavigate} role={dashboardRole} />,
    packageCatalog: <MembershipsPage mode="catalog" session={session} />,
    packageCreate: <MembershipsPage mode="create" session={session} />,
    members: <MembersPage readOnly={!hasSessionPermission(session, "member.write")} />,
    memberMemberships: <MembershipsPage mode="assign" session={session} />,
    "my-memberships": <MembershipsPage session={session} />,
    packages: <MembershipsPage session={session} />,
    payments: <PaymentsPage session={session} />,
    profile: <ProfilePage onProfileSaved={onProfileSaved} onSessionRevoked={onSessionRevoked} session={session} />,
    registrations: <RegistrationApprovalPage />,
    reports: <ReportsPage />,
    rolePermissions: dashboardRole === "admin" ? <RolePermissionPage /> : null,
    staff: <StaffPage />,
    support: dashboardRole === "member" ? <SupportPage session={session} /> : <SupportStaffPage session={session} />,
    training: <TrainingPage session={session} />,
    "my-attendance": <MemberAttendancePage />,
    "my-payments": <MemberPaymentsPage />,
    "my-training": <MemberTrainingPage />,
  };

  return pages[view] ?? pages.dashboard;
}
