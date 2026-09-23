import { lazy, Suspense, useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell.jsx";
import { dashboardApi } from "../dashboard/dashboard-api.js";
import { authApi } from "./auth-api.js";
import "./auth.css";

const ManagerPageContent = lazy(() => import("../../pages/manager/ManagerPageContent.jsx").then(({ ManagerPageContent: Component }) => ({ default: Component })));

const labels = {
  admin: "Quản trị hệ thống",
  manager: "Quản lý trung tâm",
  receptionist: "Lễ tân",
  coach: "Huấn luyện viên",
  member: "Hội viên",
};
const navigationItems = [
  { id: "dashboard", label: "Tổng quan" },
  { id: "profile", label: "Hồ sơ" },
  { id: "rolePermissions", label: "Phân quyền chức năng" },
  { id: "notification-preferences", label: "Tùy chọn thông báo" },
  { id: "members", label: "Hội viên" },
  { id: "registrations", label: "Duyệt đăng ký" },
  { id: "packages", label: "Gói tập", children: [
    { id: "packageCreate", label: "Tạo gói tập" },
    { id: "packageCatalog", label: "Danh mục gói" },
    { id: "memberMemberships", label: "Gán gói hội viên" },
  ] },
  { id: "classes", label: "Lớp học" },
  { id: "bookings", label: "Đặt chỗ" },
  { id: "attendance", label: "Điểm danh" },
  { id: "payments", label: "Thanh toán" },
  { id: "staff", label: "Danh tính & nhân sự" },
  { id: "training", label: "Giáo án" },
  { id: "reports", label: "Báo cáo" },
  { id: "audit", label: "Kiểm toán" },
  { id: "support", label: "Hỗ trợ" },
];
const memberSelfItems = [
  { id: "my-memberships", label: "Gói tập của tôi", permission: "membership.self.read" },
  { id: "my-attendance", label: "Điểm danh của tôi", permission: "attendance.self.read" },
  { id: "my-training", label: "Giáo án của tôi", permission: "training.self.read" },
  { id: "my-payments", label: "Thanh toán của tôi", permission: "payment.self.read" },
];

export function DashboardPlaceholder({ initialView = "dashboard", session, onLogout, onProfileSaved }) {
  const [view, setView] = useState(initialView);
  const [notifications, setNotifications] = useState([]);
  const granted = new Set(session.permissions ?? []);
  const access = {
    members: ["member.read", "member.write"], registrations: ["registration.approve"],
    packageCreate: ["membership.package.manage"], packageCatalog: ["membership.package.read", "membership.package.manage"], memberMemberships: ["membership.assign"],
    classes: ["class.read", "class.manage", "class.change.review", "class.change.request"], bookings: ["booking.read", "booking.write"],
    attendance: ["attendance.read", "attendance.write"], payments: ["payment.read", "payment.record"],
    staff: ["staff.manage"],
    training: ["training.write", "training.template.manage", "ai.assist.read", "ai.assist.deliver"], reports: ["report.read"], audit: ["audit.read"],
    support: ["support.ticket.read", "support.ticket.respond", "support.ticket.create"],
    "notification-preferences": ["notification.preference.manage"],
  };
  const allowed = (id) => session.user.role === "admin" || !access[id] || access[id].some((permission) => granted.has(permission));
  const navigation = navigationItems.flatMap((item) => {
    if (item.id === "rolePermissions" && session.user.role !== "admin") return [];
    if (item.children) {
      const children = item.children.filter((child) => allowed(child.id));
      return children.length ? [{ ...item, children }] : [];
    }
    return allowed(item.id) ? [item] : [];
  });
  if (session.user.role === "member") {
    navigation.push(...memberSelfItems.filter((item) => granted.has(item.permission)));
  }
  const allowedViews = new Set(navigation.flatMap((item) => [item.id, ...(item.children ?? []).map((child) => child.id)]));
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
  const content = (
    <Suspense fallback={<p className="app-shell__loading" role="status">Đang tải không gian làm việc...</p>}>
      <ManagerPageContent dashboardRole={session.user.role} onNavigate={(next) => { if (allowedViews.has(next)) setView(next); }} onProfileSaved={onProfileSaved} onSessionRevoked={onLogout} session={session} view={allowedViews.has(view) ? view : "dashboard"} />
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
