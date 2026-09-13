import { Clock3 } from "lucide-react";
import { AuthLayout } from "./AuthLayout.jsx";
export function PendingApprovalPage({ onLogin }) { return <AuthLayout><div className="auth-card auth-success"><Clock3 size={24} aria-hidden="true" /><h2>Đang chờ duyệt</h2><p>Tài khoản đã xác thực thành công. Lễ tân sẽ kiểm tra và duyệt tài khoản của bạn trước khi bạn đăng nhập.</p><button className="auth-link" type="button" onClick={onLogin}>Quay lại đăng nhập</button></div></AuthLayout>; }
