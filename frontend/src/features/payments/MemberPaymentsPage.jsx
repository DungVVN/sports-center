import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { usePagination } from "../../components/ui/usePagination.js";
import { paymentApi } from "./payment-api.js";
import "../members/members.css";

const statusLabels = { pending: "Chờ xác nhận", paid: "Đã thanh toán", failed: "Thất bại", refunded: "Đã hoàn tiền" };
const methodLabels = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản" };

export function MemberPaymentsPage() {
  const [payments, setPayments] = useState([]); const [receipt, setReceipt] = useState(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const paymentsPagination = usePagination(payments);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setPayments(await paymentApi.mine()); } catch (caught) { setError(caught.message); } finally { setLoading(false); } }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  async function openReceipt(id) { setError(""); try { setReceipt(await paymentApi.ownReceipt(id)); } catch (caught) { setError(caught.message); } }
  return <main className="members-page"><header><p>Thanh toán</p><h1>Phiếu thu của tôi</h1></header>{error && <p className="auth-alert" role="alert">{error}</p>}<section className="members-list"><div className="list-heading"><h2>Lịch sử phiếu thu</h2><Button onClick={load} size="sm" variant="ghost">Tải lại</Button></div>{loading ? <p>Đang tải giao dịch…</p> : payments.length === 0 ? <p>Chưa có phiếu thu nào.</p> : <><div className="table-scroll"><table><thead><tr><th>Mã phiếu thu</th><th>Số tiền</th><th>Phương thức</th><th>Trạng thái</th><th>Thanh toán lúc</th><th></th></tr></thead><tbody>{paymentsPagination.pageItems.map((payment) => <tr key={payment.id}><td><code>{payment.transaction_code}</code></td><td>{Number(payment.amountVnd).toLocaleString("vi-VN")} ₫</td><td>{methodLabels[payment.method] ?? payment.method}</td><td>{statusLabels[payment.status] ?? payment.status}</td><td>{payment.paid_at ? new Date(payment.paid_at).toLocaleString("vi-VN") : "—"}</td><td><Button onClick={() => openReceipt(payment.id)} size="sm" type="button" variant="secondary">Xem lịch sử</Button></td></tr>)}</tbody></table></div><Pagination {...paymentsPagination} /></>}</section>{receipt && <section className="members-list"><div className="list-heading"><h2>Biên nhận {receipt.transaction_code}</h2><Button onClick={() => setReceipt(null)} size="sm" type="button" variant="ghost">Đóng</Button></div><p>{Number(receipt.amountVnd).toLocaleString("vi-VN")} ₫ · {statusLabels[receipt.status] ?? receipt.status}</p><h3>Lịch sử trạng thái</h3>{receipt.events.length === 0 ? <p>Chưa có sự kiện trạng thái.</p> : receipt.events.map((event) => <article key={event.id}><strong>{event.event_type}</strong><p>{event.previous_status ?? "—"} → {event.new_status}</p><small>{event.occurred_at ? new Date(event.occurred_at).toLocaleString("vi-VN") : "—"}</small></article>)}</section>}</main>;
}
