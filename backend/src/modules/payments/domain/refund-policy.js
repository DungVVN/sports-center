import { AppError } from "../../../shared/errors/app-error.js";

export function assertServiceRefundPayment(payment) {
  if (!payment || payment.status !== "paid" || payment.membership_id || ![payment.course_enrollment_id, payment.pt_purchase_id, payment.facility_reservation_id].some(Boolean)) {
    throw new AppError({ statusCode: 422, code: "SERVICE_REFUND_NOT_ELIGIBLE", message: "Chỉ hoàn toàn bộ khoản đã thu của khóa/PT/sân chưa sử dụng hoặc chưa cấp được dịch vụ; giữ chính sách membership hiện tại." });
  }
}
