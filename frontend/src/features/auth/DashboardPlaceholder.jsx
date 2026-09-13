import { LogOut } from "lucide-react";
import { Button } from "../../components/ui/Button.jsx";
import { authApi } from "./auth-api.js";
const labels = { manager: "Quản lý trung tâm", receptionist: "Lễ tân", coach: "Huấn luyện viên", member: "Hội viên" };
export function DashboardPlaceholder({ session, onLogout }) { async function logout() { await authApi.logout(); onLogout(); } return <main className="dashboard-placeholder"><header><div><p>Sports Center</p><h1>{labels[session.user.role] ?? "Tổng quan"}</h1></div><Button variant="secondary" onClick={logout}><LogOut size={16} aria-hidden="true" />Đăng xuất</Button></header><section><h2>Đăng nhập thành công</h2><p>Khung dashboard dành cho {labels[session.user.role] ?? session.user.role} đã sẵn sàng. Nội dung vận hành sẽ được triển khai theo từng nhóm API MVP tiếp theo.</p></section></main>; }
