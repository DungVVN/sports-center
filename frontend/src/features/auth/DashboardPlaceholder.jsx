import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { authApi } from "./auth-api.js";
import { StaffPage } from "../staff/StaffPage.jsx";
import { MembersPage } from "../members/MembersPage.jsx";
import { MembershipsPage } from "../memberships/MembershipsPage.jsx";
import { ClassesPage } from "../classes/ClassesPage.jsx";
import { BookingsPage } from "../bookings/BookingsPage.jsx";
import { AttendancePage } from "../attendance/AttendancePage.jsx";
import { PaymentsPage } from "../payments/PaymentsPage.jsx";
import { TrainingPage } from "../training/TrainingPage.jsx";
import { dashboardApi } from "../dashboard/dashboard-api.js";
const labels = { manager: "Quản lý trung tâm", receptionist: "Lễ tân", coach: "Huấn luyện viên", member: "Hội viên" };
export function DashboardPlaceholder({ session, onLogout }) {
  const [view, setView] = useState("dashboard");
  const [summary, setSummary] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const staffRole = ["manager", "receptionist", "coach"].includes(session.user.role);

  async function loadNotifications() { try { setNotifications(await dashboardApi.notifications()); } catch { setNotifications([]); } }
  useEffect(() => { void Promise.resolve().then(async () => { try { setSummary(await dashboardApi.summary(session.user.role)); } catch { setSummary(null); } await loadNotifications(); }); }, [session.user.role]);
  async function logout() { await authApi.logout(); onLogout(); }
  async function read(id) { await dashboardApi.markNotificationRead(id); await loadNotifications(); }

  const content = view === "staff" ? <StaffPage /> : view === "members" ? <MembersPage /> : view === "packages" ? <MembershipsPage session={session} /> : view === "classes" ? <ClassesPage /> : view === "bookings" ? <BookingsPage session={session} /> : view === "attendance" ? <AttendancePage /> : view === "payments" ? <PaymentsPage /> : view === "training" ? <TrainingPage /> : null;
  if (content) return <>{content}<button className="staff-back" onClick={() => setView("dashboard")}>← Tổng quan</button></>;

  return <main className="dashboard-placeholder"><header><div><p>Sports Center</p><h1>{labels[session.user.role] ?? "Tổng quan"}</h1></div><Button variant="secondary" onClick={logout}><LogOut size={16} aria-hidden="true" />Đăng xuất</Button></header><section><h2>Tổng quan hôm nay</h2>{summary && <p>Lớp đang mở: {summary.todayClasses} · Thanh toán chờ xử lý: {summary.pendingPayments} · Gói sắp hết hạn: {summary.expiringMemberships}</p>}<h2>Thông báo</h2>{notifications.slice(0, 3).map((item) => <p key={item.id}><strong>{item.title}</strong> — {item.body}{!item.read_at && <button onClick={() => read(item.id)}>Đã đọc</button>}</p>)}<Button variant="secondary" onClick={() => setView("bookings")}>Đặt chỗ</Button>{session.user.role === "member" && <Button variant="secondary" onClick={() => setView("packages")}>Gói tập của tôi</Button>}{staffRole && <><Button onClick={() => setView("members")}>Quản lý hội viên</Button><Button variant="secondary" onClick={() => setView("classes")}>Lớp học</Button><Button variant="secondary" onClick={() => setView("attendance")}>Điểm danh</Button></>}{["manager", "receptionist"].includes(session.user.role) && <Button variant="secondary" onClick={() => setView("payments")}>Thanh toán</Button>}{["manager", "coach"].includes(session.user.role) && <Button variant="secondary" onClick={() => setView("training")}>Giáo án</Button>}{session.user.role === "manager" && <><Button variant="secondary" onClick={() => setView("staff")}>Quản lý nhân viên</Button><Button variant="secondary" onClick={() => setView("packages")}>Gói tập</Button></>}</section></main>;
}
