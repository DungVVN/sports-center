import { randomBytes, randomInt } from "node:crypto";
import { AppError } from "../../../shared/errors/app-error.js";
import { violatesUniqueConstraint, retryOnUniqueConstraint } from "../../../shared/database/unique-constraint.js";
const output = (payment) => ({
  ...payment,
  provider: payment.provider ?? payment.legacy_provider ?? null,
  amountVnd: payment.amount_vnd.toString(),
  ...(payment.provider_checkout_url && { checkoutUrl: payment.provider_checkout_url }),
  ...(payment.provider_order_code ? { providerOrderCode: payment.provider_order_code.toString() } : {}),
  member: payment.member
    ? {
        id: payment.member.id,
        fullName: payment.member.full_name,
        memberCode: payment.member.member_code,
        phone: payment.member.phone,
        email: payment.member.email,
      }
    : null,
  membership: payment.membership
    ? {
        id: payment.membership.id,
        packageName: payment.membership.package_name_snapshot,
        status: payment.membership.status,
        expiresOn: payment.membership.expires_on,
      }
    : null,
});
export function createPaymentService({ repository, auditService, payosGateway }) {
  return {
    async refunds(actor) {
      if (!["member", "manager", "receptionist", "admin"].includes(actor.role))
        throw new AppError({ statusCode: 403, code: "FORBIDDEN", message: "Không được xem hoàn tiền dịch vụ." });
      return (await repository.refunds(actor)).map((item) => ({ ...item, amountVnd: item.amount_vnd.toString() }));
    },
    async requestRefund(id, reason, actor) {
      if (!["member", "admin"].includes(actor.role))
        throw new AppError({
          statusCode: 403,
          code: "FORBIDDEN",
          message: "Yêu cầu hoàn tiền dành cho khách hàng của giao dịch.",
        });
      const item = await repository.requestRefund(id, reason, actor);
      return { ...item, amountVnd: item.amount_vnd.toString() };
    },
    async reviewRefund(id, approved, note, actor) {
      if (!["manager", "admin"].includes(actor.role))
        throw new AppError({ statusCode: 403, code: "FORBIDDEN", message: "Chỉ quản lý duyệt hoàn tiền dịch vụ." });
      const item = await repository.reviewRefund(id, approved, note, actor);
      return { ...item, amountVnd: item.amount_vnd.toString() };
    },
    async executeRefund(id, reference, actor) {
      if (!["receptionist", "admin"].includes(actor.role))
        throw new AppError({
          statusCode: 403,
          code: "FORBIDDEN",
          message: "Chỉ nhân viên thu ngân đối soát đã trả tiền.",
        });
      const item = await repository.executeRefund(id, reference, actor);
      return { ...item, amountVnd: item.amount_vnd.toString() };
    },
    async reconcile(id, note, actor) {
      if (!["manager", "admin"].includes(actor.role))
        throw new AppError({ statusCode: 403, code: "FORBIDDEN", message: "Chỉ quản lý đối soát quyền sử dụng." });
      return output(await repository.reconcile(id, note, actor));
    },
    async list(filters) {
      return (await repository.listWithDetails(filters)).map(output);
    },
    async targets(memberId) {
      const member = await repository.member(memberId);
      if (!member)
        throw new AppError({ statusCode: 404, code: "MEMBER_NOT_FOUND", message: "Không tìm thấy hội viên." });
      return repository.targets(member);
    },
    async ownPayments(actor) {
      const member = await repository.memberByUser(actor.id);
      if (!member)
        throw new AppError({
          statusCode: 404,
          code: "MEMBER_PROFILE_NOT_FOUND",
          message: "Tài khoản chưa có hồ sơ hội viên.",
        });
      return this.list({ member_id: member.id });
    },
    async get(id) {
      const [payment] = await repository.listWithDetails({ id });
      if (!payment)
        throw new AppError({ statusCode: 404, code: "PAYMENT_NOT_FOUND", message: "Không tìm thấy thanh toán." });
      return { ...output(payment), events: await repository.paymentEvents(id) };
    },
    async ownReceipt(id, actor) {
      const member = await repository.memberByUser(actor.id);
      if (!member)
        throw new AppError({
          statusCode: 404,
          code: "MEMBER_PROFILE_NOT_FOUND",
          message: "Tài khoản chưa có hồ sơ hội viên.",
        });
      const [payment] = await repository.listWithDetails({ id, member_id: member.id });
      if (!payment)
        throw new AppError({
          statusCode: 404,
          code: "PAYMENT_NOT_FOUND",
          message: "Không tìm thấy phiếu thu của bạn.",
        });
      return { ...output(payment), events: await repository.paymentEvents(id) };
    },
    async create(input, actorUserId) {
      const member = await repository.member(input.memberId);
      if (!member)
        throw new AppError({ statusCode: 404, code: "MEMBER_NOT_FOUND", message: "Không tìm thấy hội viên." });
      let amountVnd = BigInt(input.amountVnd);
      if (input.method === "online" && !input.provider)
        throw new AppError({
          statusCode: 422,
          code: "PAYMENT_PROVIDER_REQUIRED",
          message: "Cần chọn cổng thanh toán sandbox.",
        });
      if (input.membershipId) {
        const membership = await repository.membership(input.membershipId);
        if (!membership || membership.member_id !== input.memberId || membership.status !== "pending_payment")
          throw new AppError({
            statusCode: 422,
            code: "MEMBERSHIP_PAYMENT_NOT_ELIGIBLE",
            message: "Gói tập không ở trạng thái chờ thanh toán.",
          });
        if (amountVnd !== membership.price_vnd_snapshot)
          throw new AppError({
            statusCode: 422,
            code: "PAYMENT_AMOUNT_MISMATCH",
            message: "Số tiền phải khớp giá gói tập đã chốt.",
          });
      }
      if (
        [input.membershipId, input.courseEnrollmentId, input.ptPurchaseId, input.facilityReservationId].filter(Boolean)
          .length > 1
      )
        throw new AppError({
          statusCode: 422,
          code: "PAYMENT_TARGET_INVALID",
          message: "Mỗi thanh toán chỉ dành cho một dịch vụ.",
        });
      if (input.facilityReservationId) {
        const reservation = await repository.facilityReservation(input.facilityReservationId);
        if (
          !reservation ||
          reservation.requester_user_id !== member.user_id ||
          reservation.status !== "approved" ||
          reservation.payment_state !== "unpaid"
        )
          throw new AppError({
            statusCode: 422,
            code: "FACILITY_PAYMENT_NOT_ELIGIBLE",
            message: "Đơn thuê sân/phòng không còn chờ thanh toán hoặc không thuộc khách hàng.",
          });
        if (amountVnd !== reservation.total_vnd_snapshot)
          throw new AppError({
            statusCode: 422,
            code: "PAYMENT_AMOUNT_MISMATCH",
            message: "Số tiền phải khớp giá thuê đã chốt.",
          });
      }
      if (input.courseEnrollmentId) {
        const enrollment = await repository.courseEnrollment(input.courseEnrollmentId);
        if (
          !enrollment ||
          enrollment.member_id !== input.memberId ||
          enrollment.status !== "pending_payment" ||
          (enrollment.payment_expires_at && enrollment.payment_expires_at <= new Date())
        )
          throw new AppError({
            statusCode: 422,
            code: "COURSE_PAYMENT_NOT_ELIGIBLE",
            message: "Đăng ký khóa không còn chờ thanh toán.",
          });
        if (amountVnd !== enrollment.price_vnd_snapshot)
          throw new AppError({
            statusCode: 422,
            code: "PAYMENT_AMOUNT_MISMATCH",
            message: "Số tiền phải khớp học phí đã chốt.",
          });
      }
      if (input.ptPurchaseId) {
        const purchase = await repository.ptPurchase(input.ptPurchaseId);
        if (!purchase || purchase.member_id !== input.memberId || purchase.status !== "pending_payment")
          throw new AppError({
            statusCode: 422,
            code: "PT_PAYMENT_NOT_ELIGIBLE",
            message: "Gói PT không còn chờ thanh toán.",
          });
        if (amountVnd !== purchase.price_vnd_snapshot)
          throw new AppError({
            statusCode: 422,
            code: "PAYMENT_AMOUNT_MISMATCH",
            message: "Số tiền phải khớp giá PT đã chốt.",
          });
      }
      const method = input.method ?? "cash";
      const provider = method === "online" ? input.provider : null;
      let payment;
      let transactionCode;
      let providerOrderCode;
      try {
        payment = await retryOnUniqueConstraint(
          () => {
            transactionCode = `PAY-${randomBytes(4).toString("hex").toUpperCase()}`;
            providerOrderCode = provider === "payos" ? BigInt(randomInt(100_000_000, 1_000_000_000)) : null;
            return repository.createWithEvent(
              {
                transaction_code: transactionCode,
                member_id: input.memberId,
                membership_id: input.membershipId ?? null,
                ...(input.courseEnrollmentId && { course_enrollment_id: input.courseEnrollmentId }),
                ...(input.ptPurchaseId && { pt_purchase_id: input.ptPurchaseId }),
                ...(input.facilityReservationId && { facility_reservation_id: input.facilityReservationId }),
                amount_vnd: amountVnd,
                method,
                provider,
                provider_order_code: providerOrderCode,
                status: "pending",
                recorded_by: actorUserId,
                notes: input.notes ?? null,
              },
              { event_type: "payment_created", new_status: "pending", actor_user_id: actorUserId },
            );
          },
          { fields: ["transaction_code", "provider_order_code"] },
        );
      } catch (error) {
        if (input.courseEnrollmentId && violatesUniqueConstraint(error))
          throw new AppError({
            statusCode: 409,
            code: "COURSE_PAYMENT_ALREADY_EXISTS",
            message: "Đăng ký đã có giao dịch đang xử lý hoặc đã thanh toán.",
          });
        if (violatesUniqueConstraint(error))
          throw new AppError({
            statusCode: 409,
            code: "PAYMENT_CREATION_CONFLICT",
            message: "Không thể tạo mã phiếu thu. Vui lòng thử lại.",
          });
        throw error;
      }
      await auditService.record({
        actorUserId,
        action: "payment.created",
        entityType: "payment",
        entityId: payment.id,
        summary:
          method === "online"
            ? `Đã tạo thanh toán chờ xử lý qua ${provider}.`
            : "Đã lập phiếu thu tiền mặt chờ Lễ tân xác nhận.",
      });
      if (provider === "payos") {
        let link;
        try {
          link = await payosGateway.createPaymentLink({ amountVnd, orderCode: providerOrderCode, transactionCode });
        } catch (error) {
          await repository.complete({
            id: payment.id,
            status: "failed",
            paidAt: null,
            eventType: "payos_link_creation_failed",
            actorUserId,
            membershipId: payment.membership_id,
          });
          await auditService.record({
            actorUserId,
            action: "payment.payos_link_failed",
            entityType: "payment",
            entityId: payment.id,
            summary: "Không tạo được payment link PayOS; phiếu thu đã được đóng ở trạng thái thất bại.",
          });
          throw error;
        }
        await repository.saveCheckoutUrl(payment.id, link.checkoutUrl);
        return { ...output(payment), checkoutUrl: link.checkoutUrl, qrCode: link.qrCode };
      }
      return output(payment);
    },
    async payosCallback(payload) {
      const data = await payosGateway.verifyWebhook(payload);
      const payment = await repository.paymentByProviderOrderCode(data.orderCode);
      if (!payment || payment.provider !== "payos" || payment.amount_vnd !== BigInt(data.amount))
        throw new AppError({
          statusCode: 422,
          code: "PAYOS_CALLBACK_MISMATCH",
          message: "Webhook PayOS không khớp giao dịch.",
        });
      const succeeded = data.code === "00";
      const result = await repository.complete({
        id: payment.id,
        status: succeeded ? "paid" : "failed",
        paidAt: succeeded ? new Date(data.transactionDateTime) : null,
        eventType: "payos_webhook",
        actorUserId: null,
        membershipId: payment.membership_id,
      });
      // Another callback may have completed the pending-to-final transition while
      // this request waited for the row lock. Return the committed state, not the
      // stale pending snapshot read before that transaction.
      return output(result ?? (await repository.payment(payment.id)));
    },
    async confirm(id, status, actorUserId, reconciliationNote) {
      const payment = await repository.payment(id);
      if (!payment || payment.status !== "pending")
        throw new AppError({
          statusCode: 422,
          code: "PAYMENT_NOT_CONFIRMABLE",
          message: "Giao dịch không còn chờ xác nhận.",
        });
      if (payment.method === "online")
        throw new AppError({
          statusCode: 422,
          code: "PAYMENT_PROVIDER_CALLBACK_REQUIRED",
          message: "Thanh toán trực tuyến chỉ được xác nhận qua webhook đã xác thực của nhà cung cấp.",
        });
      const isBankTransfer = payment.method === "bank_transfer";
      if (isBankTransfer && status === "paid" && (!reconciliationNote || reconciliationNote.trim().length < 10))
        throw new AppError({
          statusCode: 422,
          code: "BANK_TRANSFER_RECONCILIATION_NOTE_REQUIRED",
          message: "Cần ghi chú đối soát sao kê ít nhất 10 ký tự trước khi xác nhận chuyển khoản.",
        });
      const result = await repository.complete({
        id,
        status,
        paidAt: status === "paid" ? new Date() : null,
        eventType: isBankTransfer
          ? `bank_transfer_${status === "paid" ? "reconciled" : "rejected"}`
          : "receptionist_cash_confirmation",
        actorUserId,
        membershipId: payment.membership_id,
        note: isBankTransfer ? reconciliationNote?.trim() : undefined,
      });
      if (!result)
        throw new AppError({
          statusCode: 409,
          code: "PAYMENT_ALREADY_CONFIRMED",
          message: "Giao dịch đã được xử lý bởi một xác nhận khác.",
        });
      const paymentLabel = isBankTransfer ? "chuyển khoản" : "tiền mặt";
      await auditService.record({
        actorUserId,
        action: `payment.${status}`,
        entityType: "payment",
        entityId: id,
        summary: result.fulfillment_error
          ? "Đã ghi nhận tiền đã thu; dịch vụ cần đối soát trước khi cấp quyền sử dụng."
          : status === "paid"
            ? `Lễ tân đã đối soát ${paymentLabel} và kích hoạt dịch vụ đã mua.`
            : `Lễ tân xác nhận phiếu thu ${paymentLabel} không thành công.`,
        reason: isBankTransfer ? reconciliationNote?.trim() : undefined,
      });
      return output(result);
    },
  };
}
