import { AttendancePage } from "../../features/attendance/AttendancePage.jsx";
import { RegistrationApprovalPage } from "../../features/auth/RegistrationApprovalPage.jsx";
import { DashboardHome } from "../../features/dashboard/DashboardHome.jsx";
import { BookingsPage } from "../../features/bookings/BookingsPage.jsx";
import { ClassesPage } from "../../features/classes/ClassesPage.jsx";
import { MembersPage } from "../../features/members/MembersPage.jsx";
import { MembershipsPage } from "../../features/memberships/MembershipsPage.jsx";
import { PaymentsPage } from "../../features/payments/PaymentsPage.jsx";
import { ProfilePage } from "../../features/auth/ProfilePage.jsx";
import { SupportStaffPage } from "../../features/support/SupportStaffPage.jsx";

export function ReceptionistPageContent({ onNavigate, onSessionRevoked, session, view }) {
  const pages = {
    attendance: <AttendancePage session={session} />,
    bookings: <BookingsPage session={session} />,
    classes: <ClassesPage session={session} />,
    dashboard: <DashboardHome onNavigate={onNavigate} role="receptionist" />,
    members: <MembersPage />,
    packages: <MembershipsPage session={session} />,
    payments: <PaymentsPage session={session} />,
    profile: <ProfilePage onSessionRevoked={onSessionRevoked} />,
    registrations: <RegistrationApprovalPage />,
    support: <SupportStaffPage />,
  };

  return pages[view] ?? pages.dashboard;
}
