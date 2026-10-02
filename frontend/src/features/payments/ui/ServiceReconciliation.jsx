import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { paymentApi } from "../api/payment-api.js";
import { hasSessionPermission } from "../../auth/index.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { Button } from "../../../shared/ui/Button.jsx";
import "./service-reconciliation.css";

const labels = { pending: "Chờ quản lý duyệt", approved: "Đã duyệt, chờ trả tiền", rejected: "Từ chối", completed: "Đã đối soát hoàn tiền" };
export function ServiceReconciliation({ session, payments }) {
  const client = useQueryClient();
  const canRead = session && hasSessionPermission(session, "payment.refund.read");
  const canRequest = session && hasSessionPermission(session, "payment.refund.request");
  const canReview = session && hasSessionPermission(session, "payment.refund.review");
  const canExecute = session && hasSessionPermission(session, "payment.refund.execute");
  const canReconcile = session && hasSessionPermission(session, "payment.reconcile");
  const refunds = useQuery({ queryKey: ["service-refunds"], queryFn: paymentApi.refunds, enabled: Boolean(canRead), refetchInterval: 30_000 });
  const [form, setForm] = useState({ paymentId: "", reason: "" });
  const [notes, setNotes] = useState({});
  const [notice, setNotice] = useState("");
  const mutation = useMutation({
    mutationFn: ({ action, id, input }) => paymentApi[action](id, input),
    onSuccess: async () => {
      setNotice("Đã lưu xử lý tài chính. Việc duyệt và việc xác nhận đã trả tiền là hai bước riêng.");
      await Promise.all(["service-refunds", "payments", "member", "course-enrollments", "pt-purchases", "bookings", "facility-reservations-me", "facility-reservations-staff", "facility-calendar", "reports"].map((key) => client.invalidateQueries({ queryKey: [key] })));
    },
  });
  const send = (action, id, input) => { setNotice(""); mutation.mutate({ action, id, input }); };
  if (!canRead && !canReconcile) return null;
  return <section className="members-list service-reconciliation" aria-label="Đối soát và hoàn tiền dịch vụ">
    <h2>Đối soát và hoàn tiền dịch vụ</h2>
    {notice && <p role="status">{notice}</p>}
    {mutation.isError && <p role="alert">{errorMessageFor(mutation.error, "Không xử lý được giao dịch.")}</p>}
    {canRequest && <form className="service-reconciliation__request" onSubmit={(event) => { event.preventDefault(); send("requestRefund", form.paymentId, { reason: form.reason }); }}>
      <label>Giao dịch đề nghị hoàn<select required value={form.paymentId} onChange={(event) => setForm({ ...form, paymentId: event.target.value })}><option value="">Chọn giao dịch</option>{payments.filter((item) => item.status === "paid" && !item.membership_id && (item.course_enrollment_id || item.pt_purchase_id || item.facility_reservation_id)).map((item) => <option key={item.id} value={item.id}>{item.transaction_code} · {item.service?.name} · {Number(item.amountVnd).toLocaleString("vi-VN")} đ</option>)}</select></label>
      <label>Lý do hoàn<input required minLength={10} maxLength={500} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
      <Button type="submit" loading={mutation.isPending}>Gửi đề nghị hoàn tiền</Button>
    </form>}
    {canReconcile && payments.filter((item) => item.status === "paid" && item.fulfillment_error).map((item) => <form key={item.id} onSubmit={(event) => { event.preventDefault(); send("reconcile", item.id, { note: notes[item.id] }); }}>
      <p>{item.transaction_code} · {item.service?.name} · Đã thu tiền, cần đối soát quyền sử dụng</p>
      <label>Ghi chú đối soát<input required minLength={10} maxLength={500} value={notes[item.id] ?? ""} onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })} /></label>
      <Button type="submit" loading={mutation.isPending}>Thử cấp lại dịch vụ sau đối soát</Button>
    </form>)}
    {canRead && refunds.isPending && <p role="status">Đang tải hoàn tiền...</p>}
    {refunds.isError && <p role="alert">{errorMessageFor(refunds.error, "Không tải được hoàn tiền.")} <Button onClick={() => refunds.refetch()}>Thử lại</Button></p>}
    {refunds.data?.length === 0 && <p>Chưa có yêu cầu hoàn tiền dịch vụ.</p>}
    {(refunds.data ?? []).map((item) => <article key={item.id}>
      <h3>{payments.find((payment) => payment.id === item.payment_id)?.transaction_code ?? item.payment_id}</h3>
      <p>{Number(item.amountVnd).toLocaleString("vi-VN")} đ · {labels[item.status]} · {item.reason}</p>
      {item.review_note && <p>Ý kiến quản lý: {item.review_note}</p>}
      {item.transfer_reference && <p>Mã đối soát đã trả tiền: {item.transfer_reference}</p>}
      {canReview && item.status === "pending" && <form onSubmit={(event) => { event.preventDefault(); send("reviewRefund", item.id, { approved: true, note: notes[item.id] }); }}>
        <label>Ý kiến duyệt<input required minLength={10} maxLength={500} value={notes[item.id] ?? ""} onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })} /></label>
        <Button type="submit" loading={mutation.isPending}>Duyệt và đóng quyền sử dụng</Button>
        <Button disabled={(notes[item.id]?.trim().length ?? 0) < 10} loading={mutation.isPending} onClick={() => send("reviewRefund", item.id, { approved: false, note: notes[item.id] })}>Từ chối</Button>
      </form>}
      {canExecute && item.status === "approved" && <form onSubmit={(event) => { event.preventDefault(); send("executeRefund", item.id, { transferReference: notes[item.id] }); }}>
        <label>Mã chuyển tiền/phiếu chi đã thực hiện<input required minLength={10} maxLength={500} value={notes[item.id] ?? ""} onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })} /></label>
        <label className="service-reconciliation__confirmation"><input type="checkbox" required />Tôi đã trả tiền và kiểm tra chứng từ</label>
        <Button type="submit" loading={mutation.isPending}>Xác nhận đã hoàn tiền</Button>
      </form>}
    </article>)}
  </section>;
}
