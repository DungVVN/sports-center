import { useState } from "react";
import { facilityApi } from "../api/facility-api.js";

const money = (amount) => `${Number(amount).toLocaleString("vi-VN")} đ`;
const paymentLabels = { legacy: "Đơn lịch sử", refunded: "Đã hoàn tiền", unpaid: "Chờ thanh toán", paid: "Đã thanh toán", free: "Miễn phí" };

export function RentalQuote({ item, canPay = false, busy, perform, onPayment }) {
  return <div className="facility-calendar__rental-quote">
    {item.totalVnd != null && <p>Giá đã chốt: {money(item.totalVnd)} · {money(item.hourlyRateVnd)}/giờ · {paymentLabels[item.paymentState]}</p>}
    {item.completedAt && <p>Đã chốt sử dụng · {item.completionNote}</p>}
    {item.status === "cancelled" && item.paymentState === "paid" && <p>Đơn đã hủy; khoản tiền đã thu cần đối soát hoàn tiền tại mục thanh toán.</p>}
    {canPay && item.status === "approved" && !item.completedAt && item.paymentState === "unpaid" && ["bank_transfer", "online"].map((method) => <button type="button" key={method} disabled={busy} onClick={() => void perform(() => facilityApi.payment(item.id, { method }), (payment) => {
      onPayment(payment);
      return "Đã lập giao dịch theo giá thuê đã chốt. Quyền sử dụng được xác nhận sau thanh toán.";
    })}>{method === "online" ? "Thanh toán PayOS" : "Thanh toán chuyển khoản"}</button>)}
  </div>;
}

export function RentalCompletion({ item, busy, perform }) {
  const [note, setNote] = useState("");
  return <form onSubmit={(event) => {
    event.preventDefault();
    void perform(() => facilityApi.complete(item.id, { note }), "Đã chốt sử dụng sân/phòng.");
  }}>
    <label>Ghi nhận sử dụng<input required minLength="3" maxLength="500" value={note} onChange={(event) => setNote(event.target.value)} /></label>
    <button disabled={busy}>Chốt sử dụng</button>
  </form>;
}

export function RentalPayment({ payment }) {
  return payment && <section className="facility-calendar__panel" aria-label="Thanh toán đặt sân"><h3>Giao dịch {payment.transaction_code}</h3><p>{money(payment.amountVnd)} · Xem phiếu thu trong tài khoản để theo dõi xác nhận.</p>{payment.checkoutUrl && <a href={payment.checkoutUrl} target="_blank" rel="noreferrer">Tiếp tục thanh toán PayOS</a>}</section>;
}
