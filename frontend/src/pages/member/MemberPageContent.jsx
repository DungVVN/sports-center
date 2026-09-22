import { MemberAttendancePage } from "../../features/attendance/MemberAttendancePage.jsx";
import { BookingsPage } from "../../features/bookings/BookingsPage.jsx";
import { DashboardHome } from "../../features/dashboard/DashboardHome.jsx";
import { ProfilePage } from "../../features/auth/ProfilePage.jsx";
import { MembershipsPage } from "../../features/memberships/MembershipsPage.jsx";
import { MemberPaymentsPage } from "../../features/payments/MemberPaymentsPage.jsx";
import { MemberTrainingPage } from "../../features/training/MemberTrainingPage.jsx";
import { SupportPage } from "../../features/support/SupportPage.jsx";
import { NotificationPreferencesPage } from "../../features/notifications/NotificationPreferencesPage.jsx";

export function MemberPageContent({ onNavigate, onSessionRevoked, session, view }) {
  const pages = {
    bookings: <BookingsPage session={session} />,
    dashboard: <DashboardHome onNavigate={onNavigate} role="member" />,
    "my-attendance": <MemberAttendancePage />,
    "my-payments": <MemberPaymentsPage />,
    "my-training": <MemberTrainingPage />,
    packages: <MembershipsPage session={session} />,
    profile: <ProfilePage onSessionRevoked={onSessionRevoked} />,
    support: <SupportPage />,
    "notification-preferences": <NotificationPreferencesPage />,
  };

  return pages[view] ?? pages.dashboard;
}
