import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../layouts/AppShell.jsx";
import { dashboardPath, dashboardView } from "../dashboard-routes.js";
import { dashboardApi } from "../../features/dashboard/index.js";
import { authApi } from "../../features/auth/index.js";
import { useToast } from "../../shared/ui/useToast.js";
import { errorMessageFor } from "../../shared/api/error-message.js";
import "../../features/auth/ui/auth.css";

const WorkspaceContent = lazy(() => import("../WorkspaceContent.jsx").then(({ WorkspaceContent: Component }) => ({ default: Component })));

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
  { id: "members", label: "Hội viên" },
  { id: "registrations", label: "Duyệt đăng ký" },
  { id: "packages", label: "Gói tập", children: [
    { id: "packageCreate", label: "Tạo gói tập" },
    { id: "packageCatalog", label: "Danh mục gói" },
    { id: "memberMemberships", label: "Gán gói hội viên" },
  ] },
  { id: "classes", label: "Lớp học" },
  { id: "bookings", label: "Đặt chỗ" },
  { id: "facility-calendar", label: "Lịch sân" },
  { id: "attendance", label: "Điểm danh" },
  { id: "payments", label: "Thanh toán" },
  { id: "staff", label: "Danh tính & nhân sự" },
  { id: "training", label: "Giáo án" },
  { id: "reports", label: "Báo cáo" },
  { id: "audit", label: "Nhật kí hoạt động" },
  { id: "support", label: "Hỗ trợ" },
];
const memberSelfItems = [
  { id: "my-memberships", label: "Gói tập của tôi", permission: "membership.self.read" },
  { id: "my-attendance", label: "Điểm danh của tôi", permission: "attendance.self.read" },
  { id: "my-training", label: "Giáo án của tôi", permission: "training.self.read" },
  { id: "my-payments", label: "Thanh toán của tôi", permission: "payment.self.read" },
];
const accessByView = {
  members: ["member.read", "member.write"], registrations: ["registration.approve"],
  packageCreate: ["membership.package.manage"], packageCatalog: ["membership.package.read", "membership.package.manage"], memberMemberships: ["membership.assign"],
  classes: ["class.read", "class.manage", "class.change.review", "class.change.request"], bookings: ["booking.read", "booking.write"],
  attendance: ["attendance.read", "attendance.write"], payments: ["payment.read", "payment.record"],
  staff: ["staff.manage"], training: ["training.write", "training.template.manage", "ai.assist.read", "ai.assist.deliver"], reports: ["report.read"], audit: ["audit.read"],
  support: ["support.ticket.read", "support.ticket.respond", "support.ticket.create"],
};

export function DashboardPlaceholder({ initialView = "dashboard", session, onLogout, onProfileSaved }) {
  const [view, setView] = useState(() => dashboardView(window.location.pathname) ?? initialView);
  const [notifications, setNotifications] = useState([]);
  const showToast = useToast();
  const granted = useMemo(() => new Set(session.permissions ?? []), [session.permissions]);
  const navigation = useMemo(() => {
    const allowed = (id) => session.user.role === "admin" || !accessByView[id] || accessByView[id].some((permission) => granted.has(permission));
    const items = navigationItems.flatMap((item) => {
      if (item.id === "rolePermissions" && session.user.role !== "admin") return [];
      if (item.children) {
        const children = item.children.filter((child) => allowed(child.id));
        return children.length ? [{ ...item, children }] : [];
      }
      return allowed(item.id) ? [item] : [];
    });
    if (session.user.role === "member") items.push(...memberSelfItems.filter((item) => granted.has(item.permission)));
    return items;
  }, [granted, session.user.role]);
  const allowedViews = useMemo(() => new Set(navigation.flatMap((item) => [item.id, ...(item.children ?? []).map((child) => child.id)])), [navigation]);
  const navigate = useCallback((next) => {
    if (!allowedViews.has(next)) return;
    setView(next);
    const path = dashboardPath(next);
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
  }, [allowedViews]);
  useEffect(() => {
    const syncViewFromUrl = () => {
      const next = dashboardView(window.location.pathname);
      setView(next && allowedViews.has(next) ? next : "dashboard");
    };
    const current = dashboardView(window.location.pathname);
    if (!current || !allowedViews.has(current)) window.history.replaceState({}, "", dashboardPath(allowedViews.has(initialView) ? initialView : "dashboard"));
    window.addEventListener("popstate", syncViewFromUrl);
    return () => window.removeEventListener("popstate", syncViewFromUrl);
  }, [allowedViews, initialView]);
  const notificationIds = useRef(null);
  const notificationLoadFailed = useRef(false);
  const loadNotifications = useCallback(async () => {
    try {
      const data = await dashboardApi.notifications();
      if (notificationIds.current !== null) {
        data.filter((item) => !item.read && !notificationIds.current.has(item.id))
          .forEach((item) => showToast(item.title || "Có thông báo mới", "info"));
      }
      notificationIds.current = new Set(data.map((item) => item.id));
      setNotifications(data);
      notificationLoadFailed.current = false;
    } catch (cause) {
      // Preserve the last snapshot, and report an outage once rather than every polling interval.
      if (!notificationLoadFailed.current) showToast?.(errorMessageFor(cause, "Không thể tải thông báo mới."), "error");
      notificationLoadFailed.current = true;
    }
  }, [showToast]);
  useEffect(() => {
    void Promise.resolve().then(loadNotifications);
    const timer = window.setInterval(() => void loadNotifications(), 30_000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);
  async function logout() {
    try {
      await authApi.logout();
      showToast?.("Đã đăng xuất khỏi hệ thống.", "success");
    } catch (cause) {
      showToast?.(`${errorMessageFor(cause, "Không thể kết thúc phiên trên máy chủ.")} Bạn đã được đăng xuất trên thiết bị này.`, "error");
    } finally {
      onLogout();
    }
  }
  async function read(id) {
    try {
      await dashboardApi.markNotificationRead(id);
      await loadNotifications();
      showToast?.("Đã đánh dấu thông báo là đã đọc.", "success");
    } catch (cause) {
      showToast?.(errorMessageFor(cause, "Không thể đánh dấu thông báo đã đọc."), "error");
    }
  }
  const content = (
    <Suspense fallback={<p className="app-shell__loading" role="status">Đang tải không gian làm việc...</p>}>
      <WorkspaceContent dashboardRole={session.user.role} onNavigate={navigate} onProfileSaved={onProfileSaved} onSessionRevoked={onLogout} session={session} view={allowedViews.has(view) ? view : "dashboard"} />
    </Suspense>
  );
  return (
    <AppShell
      currentView={view}
      navigation={navigation}
      notifications={notifications}
      onLogout={logout}
      onNavigate={navigate}
      onReadNotification={read}
      roleLabel={labels[session.user.role] ?? "Tổng quan"}
    >
      {content}
    </AppShell>
  );
}
