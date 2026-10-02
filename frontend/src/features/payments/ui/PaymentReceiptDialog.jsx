import { useQuery } from "@tanstack/react-query";
import { paymentApi } from "../api/payment-api.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { Button } from "../../../shared/ui/Button.jsx";
import { RecordDetails } from "../../../shared/ui/RecordDetails.jsx";
import { recordDate } from "../../../shared/lib/record-date.js";
import { RecordHistory } from "../../../shared/ui/RecordHistory.jsx";

const statuses = { pending: "Chờ xác nhận", paid: "Đã thanh toán", failed: "Thất bại", refunded: "Đã hoàn tiền" };
const methods = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản", online: "Trực tuyến" };
const eventLabels = {
  payment_created: "Tạo phiếu thu", cash_confirmed: "Xác nhận tiền mặt",
  bank_transfer_confirmed: "Xác nhận chuyển khoản", payment_rejected: "Từ chối phiếu thu",
  payos_webhook_success: "PayOS xác nhận thành công", payos_webhook_failed: "PayOS báo thất bại",
  payos_link_creation_failed: "Lỗi tạo liên kết PayOS",
  receptionist_cash_confirmation: "Xác nhận phiếu thu tiền mặt",
  bank_transfer_reconciled: "Đã đối soát chuyển khoản",
  bank_transfer_rejected: "Từ chối chuyển khoản",
  payos_webhook: "Cập nhật từ PayOS",
  course_activation_requires_review: "Cần đối soát quyền khóa học",
  pt_activation_requires_review: "Cần đối soát quyền PT",
  facility_activation_requires_review: "Cần đối soát quyền đặt sân",
  service_refund_requested: "Yêu cầu hoàn tiền dịch vụ",
  service_refund_approved: "Duyệt hoàn tiền dịch vụ",
  service_refund_rejected: "Từ chối hoàn tiền dịch vụ",
  service_refund_executed: "Đã hoàn tiền dịch vụ",
  service_activation_reconciled: "Đã đối soát quyền sử dụng dịch vụ",
};

export function PaymentReceiptDialog({ paymentId, onClose, canViewHistory }) {
  const query = useQuery({ queryKey: ["payments", "receipt", paymentId], queryFn: () => paymentApi.get(paymentId), enabled: Boolean(paymentId) });
  const receipt = query.data;
  return (
    <RecordDetails isOpen={Boolean(paymentId)} onClose={onClose} title={`Biên lai ${receipt?.transaction_code ?? "thanh toán"}`} fields={receipt ? [
      ["Mã phiếu thu", receipt.transaction_code], ["Hội viên", receipt.member?.fullName], ["Mã hội viên", receipt.member?.memberCode],
      ["Dịch vụ", receipt.service?.name ?? receipt.membership?.packageName], ["Số tiền", Number(receipt.amountVnd).toLocaleString("vi-VN") + " ₫"],
      ["Phương thức", methods[receipt.method] ?? receipt.method], ["Trạng thái", statuses[receipt.status] ?? receipt.status],
      ["Thanh toán lúc", recordDate(receipt.paid_at)], ["Ghi chú", receipt.notes], ["Lỗi cấp dịch vụ", receipt.fulfillment_error],
    ] : []}>
      {query.isLoading && <p role="status">Đang tải biên lai…</p>}
      {query.isError && <><p role="alert">{errorMessageFor(query.error, "Không thể tải biên lai.")}</p><Button onClick={() => query.refetch()} size="sm" variant="secondary">Thử lại</Button></>}
      {receipt && <section className="record-details__history"><h3>Lịch sử thanh toán</h3>
        {!receipt.events?.length && <p>Chưa có sự kiện thanh toán.</p>}
        {receipt.events?.map((event) => <article key={event.id}><strong>{eventLabels[event.event_type] ?? event.event_type}</strong><span>{statuses[event.previous_status] ?? event.previous_status ?? "Khởi tạo"} → {statuses[event.new_status] ?? event.new_status}</span><time dateTime={event.occurred_at}>{recordDate(event.occurred_at)}</time>{event.note && <p>{event.note}</p>}</article>)}
      </section>}
      {receipt && canViewHistory && <RecordHistory key={paymentId} entityType="payment" entityId={paymentId} />}
    </RecordDetails>
  );
}
