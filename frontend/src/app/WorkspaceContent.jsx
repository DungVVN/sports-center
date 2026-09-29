import { lazy, Suspense } from "react";
import { loadAttendancePage, loadMemberAttendancePage } from "../features/attendance/index.js";
import { loadProfilePage, loadRegistrationApprovalPage, hasSessionPermission } from "../features/auth/index.js";
import { loadBookingsPage } from "../features/bookings/index.js";
import { loadClassesPage } from "../features/classes/index.js";
import { loadAuditLogsPage, loadDashboardHome, loadReportsPage } from "../features/dashboard/index.js";
import { loadFacilityCalendarPage } from "../features/facilities/index.js";
import { loadMembersPage } from "../features/members/index.js";
import { loadMembershipsPage } from "../features/memberships/index.js";
import { loadMemberPaymentsPage, loadPaymentsPage } from "../features/payments/index.js";
import { loadRolePermissionPage } from "../features/role-permissions/index.js";
import { loadStaffPage } from "../features/staff/index.js";
import { loadSupportPage, loadSupportStaffPage } from "../features/support/index.js";
import { loadMemberTrainingPage, loadTrainingPage } from "../features/training/index.js";

const lazyPage = (load, exportName) => lazy(() => load().then((module) => ({ default: module[exportName] })));

const AttendancePage = lazyPage(loadAttendancePage, "AttendancePage");
const AuditLogsPage = lazyPage(loadAuditLogsPage, "AuditLogsPage");
const BookingsPage = lazyPage(loadBookingsPage, "BookingsPage");
const ClassesPage = lazyPage(loadClassesPage, "ClassesPage");
const DashboardHome = lazyPage(loadDashboardHome, "DashboardHome");
const FacilityCalendarPage = lazyPage(loadFacilityCalendarPage, "FacilityCalendarPage");
const MemberAttendancePage = lazyPage(loadMemberAttendancePage, "MemberAttendancePage");
const MemberPaymentsPage = lazyPage(loadMemberPaymentsPage, "MemberPaymentsPage");
const MembersPage = lazyPage(loadMembersPage, "MembersPage");
const MembershipsPage = lazyPage(loadMembershipsPage, "MembershipsPage");
const MemberTrainingPage = lazyPage(loadMemberTrainingPage, "MemberTrainingPage");
const PaymentsPage = lazyPage(loadPaymentsPage, "PaymentsPage");
const ProfilePage = lazyPage(loadProfilePage, "ProfilePage");
const RegistrationApprovalPage = lazyPage(loadRegistrationApprovalPage, "RegistrationApprovalPage");
const ReportsPage = lazyPage(loadReportsPage, "ReportsPage");
const RolePermissionPage = lazyPage(loadRolePermissionPage, "RolePermissionPage");
const StaffPage = lazyPage(loadStaffPage, "StaffPage");
const SupportPage = lazyPage(loadSupportPage, "SupportPage");
const SupportStaffPage = lazyPage(loadSupportStaffPage, "SupportStaffPage");
const TrainingPage = lazyPage(loadTrainingPage, "TrainingPage");

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
    members: <MembersPage readOnly={!hasSessionPermission(session, "member.write")} canResetCredentials={hasSessionPermission(session, "member.credentials.reset")} />,
    memberMemberships: <MembershipsPage mode="assign" session={session} />,
    "my-memberships": <MembershipsPage session={session} />,
    packages: <MembershipsPage session={session} />,
    payments: <PaymentsPage session={session} />,
    profile: <ProfilePage onProfileSaved={onProfileSaved} onSessionRevoked={onSessionRevoked} session={session} />,
    registrations: <RegistrationApprovalPage />,
    reports: <ReportsPage />,
    rolePermissions: dashboardRole === "admin" ? <RolePermissionPage /> : null,
    staff: <StaffPage session={session} />,
    support: dashboardRole === "member" ? <SupportPage session={session} /> : <SupportStaffPage session={session} />,
    training: <TrainingPage session={session} />,
    "my-attendance": <MemberAttendancePage />,
    "my-payments": <MemberPaymentsPage />,
    "my-training": <MemberTrainingPage />,
  };

  return (
    <Suspense fallback={<main className="app-shell__loading" role="status">Đang tải trang...</main>}>
      {pages[view] ?? pages.dashboard}
    </Suspense>
  );
}
