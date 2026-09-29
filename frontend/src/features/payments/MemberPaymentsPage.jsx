import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../shared/ui/Button.jsx";
import { Dialog } from "../../shared/ui/Dialog.jsx";
import { Pagination } from "../../shared/ui/Pagination.jsx";
import { usePagination } from "../../shared/ui/usePagination.js";
import { paymentApi } from "./payment-api.js";
import { errorMessageFor } from "../../shared/api/error-message.js";

const statusLabels = {
  pending: "Chờ xác nhận",
  paid: "Đã thanh toán",
  failed: "Thất bại",
  refunded: "Đã hoàn tiền",
};
const methodLabels = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản", online: "Trực tuyến" };
const eventTypeLabels = {
  payment_created: "Tạo phiếu thu",
  cash_confirmed: "Lễ tân xác nhận tiền mặt",
  payos_webhook_success: "Cổng PayOS xác nhận thành công",
  payos_webhook_failed: "Cổng PayOS báo thất bại",
  payos_link_creation_failed: "Lỗi tạo link PayOS",
  payment_rejected: "Từ chối thanh toán",
};

export function MemberPaymentsPage() {
  const paymentsQuery = useQuery({ queryKey: ["member", "payments"], queryFn: paymentApi.mine, refetchInterval: 30_000 });
  const [receiptId, setReceiptId] = useState(null);
  const receiptQuery = useQuery({ queryKey: ["member", "payments", receiptId], queryFn: () => paymentApi.ownReceipt(receiptId), enabled: Boolean(receiptId) });
  const payments = paymentsQuery.data ?? [];
  const receipt = receiptQuery.data ?? null;
  const paymentsPagination = usePagination(payments);


  return (
    <main className="members-page">
      <header>
        <p>Thanh toán</p>
        <h1>Phiếu thu của tôi</h1>
      </header>
      {(paymentsQuery.isError || receiptQuery.isError) && <p className="auth-alert" role="alert">{paymentsQuery.isError ? errorMessageFor(paymentsQuery.error, "Không thể tải phiếu thu.") : errorMessageFor(receiptQuery.error, "Không thể tải chi tiết phiếu thu.")}</p>}
      <section className="members-list">
        <div className="list-heading">
          <h2>Lịch sử phiếu thu</h2>
          <Button onClick={paymentsQuery.refetch} size="sm" variant="ghost">
            Tải lại
          </Button>
        </div>
        {paymentsQuery.isLoading ? (
          <p>Đang tải giao dịch…</p>
        ) : payments.length === 0 ? (
          <p>Chưa có phiếu thu nào.</p>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Mã phiếu thu</th>
                    <th>Gói dịch vụ</th>
                    <th>Số tiền</th>
                    <th>Phương thức</th>
                    <th>Trạng thái</th>
                    <th>Thanh toán lúc</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {paymentsPagination.pageItems.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <code>{payment.transaction_code}</code>
                      </td>
                      <td>
                        <strong>{payment.membership?.packageName ?? "Gói tập / Dịch vụ"}</strong>
                      </td>
                      <td>{Number(payment.amountVnd).toLocaleString("vi-VN")} ₫</td>
                      <td>{methodLabels[payment.method] ?? payment.method}</td>
                      <td>
                        <span
                          className={
                            payment.status === "paid"
                              ? "badge badge--success"
                              : payment.status === "failed"
                              ? "badge badge--danger"
                              : "badge badge--warning"
                          }
                        >
                          {statusLabels[payment.status] ?? payment.status}
                        </span>
                      </td>
                      <td>{payment.paid_at ? new Date(payment.paid_at).toLocaleString("vi-VN") : "—"}</td>
                      <td>
                        <Button onClick={() => setReceiptId(payment.id)} size="sm" type="button" variant="secondary">
                          Xem chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...paymentsPagination} />
          </>
        )}
      </section>
      <Dialog
        isOpen={Boolean(receipt)}
        onClose={() => setReceiptId(null)}
        title={`Biên nhận ${receipt?.transaction_code ?? ""}`}
      >
        {receipt && (
          <div style={{ display: "grid", gap: "16px", padding: "8px 0" }}>
            <div style={{ padding: "14px", background: "var(--color-surface-muted)", borderRadius: "var(--radius-control)" }}>
              <p style={{ margin: "0 0 8px" }}>
                <strong>Dịch vụ:</strong> {receipt.membership?.packageName ?? "Gói tập / Dịch vụ"}
              </p>
              <p style={{ margin: "0 0 8px" }}>
                <strong>Số tiền:</strong> {Number(receipt.amountVnd).toLocaleString("vi-VN")} ₫ ·{" "}
                <strong>Phương thức:</strong> {methodLabels[receipt.method] ?? receipt.method}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Trạng thái:</strong>{" "}
                <span
                  className={
                    receipt.status === "paid"
                      ? "badge badge--success"
                      : receipt.status === "failed"
                      ? "badge badge--danger"
                      : "badge badge--warning"
                  }
                >
                  {statusLabels[receipt.status] ?? receipt.status}
                </span>
              </p>
            </div>
            <div>
              <h3 style={{ margin: "0 0 10px", fontSize: "15px" }}>Lịch sử trạng thái</h3>
              {receipt.events.length === 0 ? (
                <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>Chưa có sự kiện trạng thái.</p>
              ) : (
                <div style={{ display: "grid", gap: "10px", maxHeight: "240px", overflowY: "auto" }}>
                  {receipt.events.map((event) => (
                    <article key={event.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--color-border)" }}>
                      <strong>{eventTypeLabels[event.event_type] ?? event.event_type}</strong>
                      <p style={{ margin: "4px 0" }}>
                        {statusLabels[event.previous_status] ?? event.previous_status ?? "Khởi tạo"} →{" "}
                        {statusLabels[event.new_status] ?? event.new_status}
                      </p>
                      <small style={{ color: "var(--color-text-secondary)" }}>
                        {event.occurred_at ? new Date(event.occurred_at).toLocaleString("vi-VN") : "—"}
                      </small>
                    </article>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
              <Button onClick={() => setReceiptId(null)} size="sm" type="button" variant="secondary">
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </main>
  );
}
