import { AttendancePage } from "../../features/attendance/AttendancePage.jsx";
import { AuditLogsPage } from "../../features/dashboard/AuditLogsPage.jsx";
import { DashboardHome } from "../../features/dashboard/DashboardHome.jsx";
import { ReportsPage } from "../../features/dashboard/ReportsPage.jsx";
import { RegistrationApprovalPage } from "../../features/auth/RegistrationApprovalPage.jsx";
import { BookingsPage } from "../../features/bookings/BookingsPage.jsx";
import { ClassesPage } from "../../features/classes/ClassesPage.jsx";
import { MembersPage } from "../../features/members/MembersPage.jsx";
import { MembershipsPage } from "../../features/memberships/MembershipsPage.jsx";
import { PaymentsPage } from "../../features/payments/PaymentsPage.jsx";
import { StaffPage } from "../../features/staff/StaffPage.jsx";
import { TrainingPage } from "../../features/training/TrainingPage.jsx";
import { ProfilePage } from "../../features/auth/ProfilePage.jsx";
import { SupportStaffPage } from "../../features/support/SupportStaffPage.jsx";

export function ManagerPageContent({ onNavigate, onSessionRevoked, session, view, dashboardRole = "manager" }) {
  const pages = {
    attendance: <AttendancePage session={session} />,
    audit: <AuditLogsPage />,
    bookings: <BookingsPage session={session} />,
    classes: <ClassesPage session={session} />,
    dashboard: <DashboardHome onNavigate={onNavigate} role={dashboardRole} />,
    packageCatalog: <MembershipsPage mode="catalog" session={session} />,
    packageCreate: <MembershipsPage mode="create" session={session} />,
    members: <MembersPage readOnly />,
    packages: <MembershipsPage session={session} />,
    payments: <PaymentsPage session={session} />,
    profile: <ProfilePage onSessionRevoked={onSessionRevoked} />,
    registrations: <RegistrationApprovalPage />,
    reports: <ReportsPage />,
    staff: <StaffPage />,
    support: <SupportStaffPage />,
    training: <TrainingPage session={session} />,
  };

  return pages[view] ?? pages.dashboard;
}
