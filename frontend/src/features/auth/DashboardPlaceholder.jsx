import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { authApi } from "./auth-api.js";
import { StaffPage } from "../staff/StaffPage.jsx";
const labels = { manager: "Quản lý trung tâm", receptionist: "Lễ tân", coach: "Huấn luyện viên", member: "Hội viên" };
export function DashboardPlaceholder({ session, onLogout }) { const [staffView, setStaffView] = useState(false); async function logout() { await authApi.logout(); onLogout(); } if (staffView) return <><StaffPage /><button className="staff-back" onClick={() => setStaffView(false)}>← Tổng quan</button></>; return <main className="dashboard-placeholder"><header><div><p>Sports Center</p><h1>{labels[session.user.role] ?? "Tổng quan"}</h1></div><Button variant="secondary" onClick={logout}><LogOut size={16} aria-hidden="true" />Đăng xuất</Button></header><section><h2>Đăng nhập thành công</h2><p>Khung dashboard dành cho {labels[session.user.role] ?? session.user.role} đã sẵn sàng.</p>{session.user.role === "manager" && <Button onClick={() => setStaffView(true)}>Quản lý nhân viên</Button>}</section></main>; }
