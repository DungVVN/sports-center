import { lazy, Suspense } from "react";
import { hasSessionPermission } from "../utils/session-permissions.js";

const lazyPage = (load, exportName) => lazy(() => load().then((module) => ({ default: module[exportName] })));

const AttendancePage = lazyPage(() => import("../features/attendance/AttendancePage.jsx"), "AttendancePage");
const AuditLogsPage = lazyPage(() => import("../features/dashboard/AuditLogsPage.jsx"), "AuditLogsPage");
const BookingsPage = lazyPage(() => import("../features/bookings/BookingsPage.jsx"), "BookingsPage");
const ClassesPage = lazyPage(() => import("../features/classes/ClassesPage.jsx"), "ClassesPage");
const DashboardHome = lazyPage(() => import("../features/dashboard/DashboardHome.jsx"), "DashboardHome");
const FacilityCalendarPage = lazyPage(() => import("../features/facilities/FacilityCalendarPage.jsx"), "FacilityCalendarPage");
const MemberAttendancePage = lazyPage(() => import("../features/attendance/MemberAttendancePage.jsx"), "MemberAttendancePage");
const MemberPaymentsPage = lazyPage(() => import("../features/payments/MemberPaymentsPage.jsx"), "MemberPaymentsPage");
const MembersPage = lazyPage(() => import("../features/members/MembersPage.jsx"), "MembersPage");
const MembershipsPage = lazyPage(() => import("../features/memberships/MembershipsPage.jsx"), "MembershipsPage");
const MemberTrainingPage = lazyPage(() => import("../features/training/MemberTrainingPage.jsx"), "MemberTrainingPage");
const PaymentsPage = lazyPage(() => import("../features/payments/PaymentsPage.jsx"), "PaymentsPage");
const ProfilePage = lazyPage(() => import("../features/auth/ProfilePage.jsx"), "ProfilePage");
const RegistrationApprovalPage = lazyPage(() => import("../features/auth/RegistrationApprovalPage.jsx"), "RegistrationApprovalPage");
const ReportsPage = lazyPage(() => import("../features/dashboard/ReportsPage.jsx"), "ReportsPage");
const RolePermissionPage = lazyPage(() => import("../features/role-permissions/RolePermissionPage.jsx"), "RolePermissionPage");
const StaffPage = lazyPage(() => import("../features/staff/StaffPage.jsx"), "StaffPage");
const SupportPage = lazyPage(() => import("../features/support/SupportPage.jsx"), "SupportPage");
const SupportStaffPage = lazyPage(() => import("../features/support/SupportStaffPage.jsx"), "SupportStaffPage");
const TrainingPage = lazyPage(() => import("../features/training/TrainingPage.jsx"), "TrainingPage");

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

  return (
    <Suspense fallback={<main className="app-shell__loading" role="status">Đang tải trang...</main>}>
      {pages[view] ?? pages.dashboard}
    </Suspense>
  );
}
