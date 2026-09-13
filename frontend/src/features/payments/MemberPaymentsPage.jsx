import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { paymentApi } from "./payment-api.js";
import "../members/members.css";

const statusLabels = { pending: "Chờ xác nhận", paid: "Đã thanh toán", failed: "Thất bại", refunded: "Đã hoàn tiền" };
const methodLabels = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản", online: "Cổng thanh toán" };

export function MemberPaymentsPage() {
  const [payments, setPayments] = useState([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setPayments(await paymentApi.mine()); } catch (caught) { setError(caught.message); } finally { setLoading(false); } }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  return <main className="members-page"><header><p>Thanh toán</p><h1>Giao dịch của tôi</h1></header>{error && <p className="auth-alert" role="alert">{error}</p>}<section className="members-list"><div className="list-heading"><h2>Lịch sử giao dịch</h2><Button onClick={load} size="sm" variant="ghost">Tải lại</Button></div>{loading ? <p>Đang tải giao dịch…</p> : payments.length === 0 ? <p>Chưa có giao dịch nào.</p> : <div className="table-scroll"><table><thead><tr><th>Mã</th><th>Số tiền</th><th>Phương thức</th><th>Trạng thái</th><th>Thanh toán lúc</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><code>{payment.transaction_code}</code></td><td>{Number(payment.amountVnd).toLocaleString("vi-VN")} ₫</td><td>{payment.provider ?? methodLabels[payment.method] ?? payment.method}</td><td>{statusLabels[payment.status] ?? payment.status}</td><td>{payment.paid_at ? new Date(payment.paid_at).toLocaleString("vi-VN") : "—"}</td></tr>)}</tbody></table></div>}</section></main>;
}
