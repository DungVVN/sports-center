import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/layout/AppShell.jsx";
import { dashboardApi } from "../dashboard/dashboard-api.js";
import { authApi } from "./auth-api.js";
import "./auth.css";

const CoachPageContent = lazy(() => import("../../pages/coach/CoachPageContent.jsx").then(({ CoachPageContent: Component }) => ({ default: Component })));
const ManagerPageContent = lazy(() => import("../../pages/manager/ManagerPageContent.jsx").then(({ ManagerPageContent: Component }) => ({ default: Component })));
const MemberPageContent = lazy(() => import("../../pages/member/MemberPageContent.jsx").then(({ MemberPageContent: Component }) => ({ default: Component })));
const ReceptionistPageContent = lazy(() => import("../../pages/receptionist/ReceptionistPageContent.jsx").then(({ ReceptionistPageContent: Component }) => ({ default: Component })));

const labels = {
  manager: "Quản lý trung tâm",
  receptionist: "Lễ tân",
  coach: "Huấn luyện viên",
  member: "Hội viên",
};
const navigationByRole = {
  manager: [
    { id: "dashboard", label: "Tổng quan" },
    { id: "profile", label: "Hồ sơ" },
    { id: "members", label: "Hội viên" },
    {
      id: "packages",
      label: "Gói tập",
      children: [
        { id: "packageCreate", label: "Tạo gói tập" },
        { id: "packageCatalog", label: "Danh mục gói" },
      ],
    },
    { id: "classes", label: "Lớp học" },
    { id: "bookings", label: "Đặt chỗ" },
    { id: "attendance", label: "Điểm danh" },
    { id: "payments", label: "Thanh toán" },
    { id: "staff", label: "Nhân viên" },
    { id: "reports", label: "Báo cáo" },
    { id: "audit", label: "Kiểm toán" },
  ],
  receptionist: [
    { id: "dashboard", label: "Tổng quan" },
    { id: "profile", label: "Hồ sơ" },
    { id: "members", label: "Hội viên" },
    { id: "registrations", label: "Duyệt đăng ký" },
    { id: "packages", label: "Gói tập" },
    { id: "classes", label: "Lớp học" },
    { id: "bookings", label: "Đặt chỗ" },
    { id: "attendance", label: "Điểm danh" },
    { id: "payments", label: "Thanh toán" },
  ],
  coach: [
    { id: "dashboard", label: "Tổng quan" },
    { id: "profile", label: "Hồ sơ" },
    { id: "classes", label: "Lớp học" },
    { id: "bookings", label: "Đặt chỗ" },
    { id: "attendance", label: "Điểm danh" },
    { id: "training", label: "Giáo án" },
  ],
  member: [
    { id: "dashboard", label: "Tổng quan" },
    { id: "profile", label: "Hồ sơ" },
    { id: "packages", label: "Gói tập" },
    { id: "bookings", label: "Đặt chỗ" },
    { id: "my-attendance", label: "Điểm danh" },
    { id: "my-training", label: "Giáo án" },
    { id: "my-payments", label: "Thanh toán" },
    { id: "support", label: "Hỗ trợ" },
    { id: "notification-preferences", label: "Tùy chọn thông báo" },
  ],
};

export function DashboardPlaceholder({ session, onLogout }) {
  const [view, setView] = useState("dashboard");
  const [notifications, setNotifications] = useState([]);
  const navigation = useMemo(
    () => navigationByRole[session.user.role] ?? navigationByRole.member,
    [session.user.role],
  );
  async function loadNotifications() {
    try {
      setNotifications(await dashboardApi.notifications());
    } catch {
      setNotifications([]);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(loadNotifications);
    const timer = window.setInterval(() => void loadNotifications(), 30_000);
    return () => window.clearInterval(timer);
  }, [session.user.role]);
  async function logout() {
    try {
      await authApi.logout();
    } finally {
      onLogout();
    }
  }
  async function read(id) {
    try {
      await dashboardApi.markNotificationRead(id);
      await loadNotifications();
    } catch {
      /* A notification remains unread if the server rejects the update. */
    }
  }
  const rolePages = {
    coach: CoachPageContent,
    manager: ManagerPageContent,
    member: MemberPageContent,
    receptionist: ReceptionistPageContent,
  };
  const RolePageContent = rolePages[session.user.role] ?? MemberPageContent;
  const content = (
    <Suspense fallback={<p className="app-shell__loading" role="status">Đang tải không gian làm việc...</p>}>
      <RolePageContent onNavigate={setView} session={session} view={view} />
    </Suspense>
  );
  return (
    <AppShell
      currentView={view}
      navigation={navigation}
      notifications={notifications}
      onLogout={logout}
      onNavigate={setView}
      onReadNotification={read}
      roleLabel={labels[session.user.role] ?? "Tổng quan"}
    >
      {content}
    </AppShell>
  );
}
