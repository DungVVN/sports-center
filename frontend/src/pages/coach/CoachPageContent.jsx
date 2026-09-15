import { AttendancePage } from "../../features/attendance/AttendancePage.jsx";
import { BookingsPage } from "../../features/bookings/BookingsPage.jsx";
import { ClassesPage } from "../../features/classes/ClassesPage.jsx";
import { DashboardHome } from "../../features/dashboard/DashboardHome.jsx";
import { TrainingPage } from "../../features/training/TrainingPage.jsx";
import { ProfilePage } from "../../features/auth/ProfilePage.jsx";

export function CoachPageContent({ onNavigate, session, view }) {
  const pages = {
    attendance: <AttendancePage session={session} />,
    bookings: <BookingsPage session={session} />,
    classes: <ClassesPage session={session} />,
    dashboard: <DashboardHome onNavigate={onNavigate} role="coach" />,
    profile: <ProfilePage />,
    training: <TrainingPage session={session} />,
  };

  return pages[view] ?? pages.dashboard;
}
