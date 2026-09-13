import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/layout/AppShell.jsx";
import { AttendancePage } from "../attendance/AttendancePage.jsx";
import { BookingsPage } from "../bookings/BookingsPage.jsx";
import { ClassesPage } from "../classes/ClassesPage.jsx";
import { ReportsPage } from "../dashboard/ReportsPage.jsx";
import { AuditLogsPage } from "../dashboard/AuditLogsPage.jsx";
import { dashboardApi } from "../dashboard/dashboard-api.js";
import { MembersPage } from "../members/MembersPage.jsx";
import { MemberProfilePage } from "../members/MemberProfilePage.jsx";
import { MembershipsPage } from "../memberships/MembershipsPage.jsx";
import { PaymentsPage } from "../payments/PaymentsPage.jsx";
import { StaffPage } from "../staff/StaffPage.jsx";
import { TrainingPage } from "../training/TrainingPage.jsx";
import { authApi } from "./auth-api.js";
import { RegistrationApprovalPage } from "./RegistrationApprovalPage.jsx";
import "./auth.css";

const labels = { manager: "Quản lý trung tâm", receptionist: "Lễ tân", coach: "Huấn luyện viên", member: "Hội viên" };
const navigationByRole = { manager: [{ id: "dashboard", label: "Tổng quan" }, { id: "members", label: "Hội viên" }, { id: "registrations", label: "Duyệt đăng ký" }, { id: "packages", label: "Gói tập" }, { id: "classes", label: "Lớp học" }, { id: "bookings", label: "Đặt chỗ" }, { id: "attendance", label: "Điểm danh" }, { id: "payments", label: "Thanh toán" }, { id: "training", label: "Giáo án" }, { id: "staff", label: "Nhân viên" }, { id: "reports", label: "Báo cáo" }, { id: "audit", label: "Kiểm toán" }], receptionist: [{ id: "dashboard", label: "Tổng quan" }, { id: "members", label: "Hội viên" }, { id: "registrations", label: "Duyệt đăng ký" }, { id: "packages", label: "Gói tập" }, { id: "classes", label: "Lớp học" }, { id: "bookings", label: "Đặt chỗ" }, { id: "attendance", label: "Điểm danh" }, { id: "payments", label: "Thanh toán" }], coach: [{ id: "dashboard", label: "Tổng quan" }, { id: "classes", label: "Lớp học" }, { id: "bookings", label: "Đặt chỗ" }, { id: "attendance", label: "Điểm danh" }, { id: "training", label: "Giáo án" }], member: [{ id: "dashboard", label: "Tổng quan" }, { id: "profile", label: "Hồ sơ" }, { id: "packages", label: "Gói tập" }, { id: "bookings", label: "Đặt chỗ" }] };

export function DashboardPlaceholder({ session, onLogout }) {
  const [view, setView] = useState("dashboard"); const [summary, setSummary] = useState(null); const [notifications, setNotifications] = useState([]);
  const navigation = useMemo(() => navigationByRole[session.user.role] ?? navigationByRole.member, [session.user.role]);
  async function loadNotifications() { try { setNotifications(await dashboardApi.notifications()); } catch { setNotifications([]); } }
  useEffect(() => { void Promise.resolve().then(async () => { try { setSummary(await dashboardApi.summary(session.user.role)); } catch { setSummary(null); } await loadNotifications(); }); }, [session.user.role]);
  async function logout() { await authApi.logout(); onLogout(); }
  async function read(id) { try { await dashboardApi.markNotificationRead(id); await loadNotifications(); } catch { /* A notification remains unread if the server rejects the update. */ } }
  const content = { staff: <StaffPage />, members: <MembersPage />, profile: <MemberProfilePage />, registrations: <RegistrationApprovalPage />, packages: <MembershipsPage session={session} />, classes: <ClassesPage session={session} />, bookings: <BookingsPage session={session} />, attendance: <AttendancePage session={session} />, payments: <PaymentsPage />, training: <TrainingPage session={session} />, reports: <ReportsPage />, audit: <AuditLogsPage /> }[view] ?? <DashboardHome summary={summary} role={session.user.role} onNavigate={setView} />;
  return <AppShell currentView={view} navigation={navigation} notifications={notifications} onLogout={logout} onNavigate={setView} onReadNotification={read} roleLabel={labels[session.user.role] ?? "Tổng quan"}>{content}</AppShell>;
}

function DashboardHome({ summary, role, onNavigate }) { const actions = role === "receptionist" ? [{ id: "members", label: "Tìm hội viên" }, { id: "attendance", label: "Check-in" }, { id: "payments", label: "Ghi nhận thanh toán" }] : role === "coach" ? [{ id: "attendance", label: "Điểm danh lớp" }, { id: "training", label: "Cập nhật giáo án" }] : role === "member" ? [{ id: "bookings", label: "Đặt lớp" }, { id: "packages", label: "Gói tập của tôi" }] : [{ id: "members", label: "Hội viên cần chú ý" }, { id: "reports", label: "Xem báo cáo" }, { id: "classes", label: "Quản lý lớp học" }]; const labels = role === "member" ? ["Lớp đã đặt hôm nay", "Gói chờ thanh toán", "Gói sắp hết hạn"] : role === "coach" ? ["Lớp phụ trách hôm nay", "Thanh toán chờ xử lý", "Gói sắp hết hạn"] : ["Lớp đang mở", "Thanh toán chờ xử lý", "Gói sắp hết hạn"]; return <section className="dashboard-home"><header><div><p>Tổng quan hôm nay</p><h1>Vận hành Sports Center</h1></div></header><div className="dashboard-kpis"><article><span>{labels[0]}</span><strong>{summary?.todayClasses ?? "—"}</strong></article><article><span>{labels[1]}</span><strong>{summary?.pendingPayments ?? "—"}</strong></article><article><span>{labels[2]}</span><strong>{summary?.expiringMemberships ?? "—"}</strong></article></div><section className="dashboard-actions"><h2>Thao tác nhanh</h2><div>{actions.map((action) => <button key={action.id} onClick={() => onNavigate(action.id)} type="button">{action.label}<span>→</span></button>)}</div></section></section>; }
