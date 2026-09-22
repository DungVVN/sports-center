import { randomBytes, randomInt } from "node:crypto";
import { AppError } from "../../shared/errors/app-error.js";
import { createPayosPaymentLink, verifyPayosWebhook } from "./payos-gateway.js";
const output = (payment) => ({ ...payment, amountVnd: payment.amount_vnd.toString(), ...(payment.provider_order_code ? { providerOrderCode: payment.provider_order_code.toString() } : {}), member: payment.member ? { id: payment.member.id, fullName: payment.member.full_name, memberCode: payment.member.member_code, phone: payment.member.phone, email: payment.member.email } : null, membership: payment.membership ? { id: payment.membership.id, packageName: payment.membership.package_name_snapshot, status: payment.membership.status, expiresOn: payment.membership.expires_on } : null });
export function createPaymentService({ repository, auditService, payosGateway = { createPaymentLink: createPayosPaymentLink, verifyWebhook: verifyPayosWebhook } }) { return {
  async list(filters) { return (await repository.listWithDetails(filters)).map(output); },
  async ownPayments(actor) { const member = await repository.memberByUser(actor.id); if (!member) throw new AppError({ statusCode: 404, code: "MEMBER_PROFILE_NOT_FOUND", message: "Tài khoản chưa có hồ sơ hội viên." }); return this.list({ member_id: member.id }); },
  async get(id) { const [payment] = await repository.listWithDetails({ id }); if (!payment) throw new AppError({ statusCode: 404, code: "PAYMENT_NOT_FOUND", message: "Không tìm thấy thanh toán." }); return { ...output(payment), events: await repository.paymentEvents(id) }; },
  async ownReceipt(id, actor) { const member = await repository.memberByUser(actor.id); if (!member) throw new AppError({ statusCode: 404, code: "MEMBER_PROFILE_NOT_FOUND", message: "Tài khoản chưa có hồ sơ hội viên." }); const [payment] = await repository.listWithDetails({ id, member_id: member.id }); if (!payment) throw new AppError({ statusCode: 404, code: "PAYMENT_NOT_FOUND", message: "Không tìm thấy phiếu thu của bạn." }); return { ...output(payment), events: await repository.paymentEvents(id) }; },
  async create(input, actorUserId) { const member = await repository.member(input.memberId); if (!member) throw new AppError({ statusCode: 404, code: "MEMBER_NOT_FOUND", message: "Không tìm thấy hội viên." }); let amountVnd = BigInt(input.amountVnd); if (input.method === "online" && !input.provider) throw new AppError({ statusCode: 422, code: "PAYMENT_PROVIDER_REQUIRED", message: "Cần chọn cổng thanh toán sandbox." }); if (input.membershipId) { const membership = await repository.membership(input.membershipId); if (!membership || membership.member_id !== input.memberId || membership.status !== "pending_payment") throw new AppError({ statusCode: 422, code: "MEMBERSHIP_PAYMENT_NOT_ELIGIBLE", message: "Gói tập không ở trạng thái chờ thanh toán." }); if (amountVnd !== membership.price_vnd_snapshot) throw new AppError({ statusCode: 422, code: "PAYMENT_AMOUNT_MISMATCH", message: "Số tiền phải khớp giá gói tập đã chốt." }); }
    const method = input.method ?? "cash"; const provider = method === "online" ? input.provider : null;
    const transactionCode = `PAY-${randomBytes(4).toString("hex").toUpperCase()}`;
    const providerOrderCode = provider === "payos" ? BigInt(randomInt(100_000_000, 1_000_000_000)) : null;
    const payment = await repository.createWithEvent({ transaction_code: transactionCode, member_id: input.memberId, membership_id: input.membershipId ?? null, amount_vnd: amountVnd, method, provider, provider_order_code: providerOrderCode, status: "pending", recorded_by: actorUserId, notes: input.notes ?? null }, { event_type: "payment_created", new_status: "pending", actor_user_id: actorUserId });
    await auditService.record({ actorUserId, action: "payment.created", entityType: "payment", entityId: payment.id, summary: method === "online" ? `Đã tạo thanh toán chờ xử lý qua ${provider}.` : "Đã lập phiếu thu tiền mặt chờ Lễ tân xác nhận." });
    if (provider === "payos") {
      let link;
      try {
        link = await payosGateway.createPaymentLink({ amountVnd, orderCode: providerOrderCode, transactionCode });
      } catch (error) {
        await repository.complete({ id: payment.id, status: "failed", paidAt: null, eventType: "payos_link_creation_failed", actorUserId, membershipId: payment.membership_id });
        await auditService.record({ actorUserId, action: "payment.payos_link_failed", entityType: "payment", entityId: payment.id, summary: "Không tạo được payment link PayOS; phiếu thu đã được đóng ở trạng thái thất bại." });
        throw error;
      }
      return { ...output(payment), checkoutUrl: link.checkoutUrl, qrCode: link.qrCode };
    }
    return output(payment);
  },
  async payosCallback(payload) {
    const data = await payosGateway.verifyWebhook(payload);
    const payment = await repository.paymentByProviderOrderCode(data.orderCode);
    if (!payment || payment.provider !== "payos" || payment.amount_vnd !== BigInt(data.amount)) throw new AppError({ statusCode: 422, code: "PAYOS_CALLBACK_MISMATCH", message: "Webhook PayOS không khớp giao dịch." });
    const succeeded = data.code === "00";
    const result = await repository.complete({ id: payment.id, status: succeeded ? "paid" : "failed", paidAt: succeeded ? new Date(data.transactionDateTime) : null, eventType: "payos_webhook", actorUserId: null, membershipId: payment.membership_id });
    return result ? output(result) : output(payment);
  },
  async confirm(id, status, actorUserId, reconciliationNote) {
    const payment = await repository.payment(id);
    if (!payment || payment.status !== "pending") throw new AppError({ statusCode: 422, code: "PAYMENT_NOT_CONFIRMABLE", message: "Giao dịch không còn chờ xác nhận." });
    if (payment.method === "online") throw new AppError({ statusCode: 422, code: "PAYMENT_PROVIDER_CALLBACK_REQUIRED", message: "Thanh toán trực tuyến chỉ được xác nhận qua webhook đã xác thực của nhà cung cấp." });
    const isBankTransfer = payment.method === "bank_transfer";
    if (isBankTransfer && status === "paid" && (!reconciliationNote || reconciliationNote.trim().length < 10)) throw new AppError({ statusCode: 422, code: "BANK_TRANSFER_RECONCILIATION_NOTE_REQUIRED", message: "Cần ghi chú đối soát sao kê ít nhất 10 ký tự trước khi xác nhận chuyển khoản." });
    const result = await repository.complete({ id, status, paidAt: status === "paid" ? new Date() : null, eventType: isBankTransfer ? `bank_transfer_${status === "paid" ? "reconciled" : "rejected"}` : "receptionist_cash_confirmation", actorUserId, membershipId: payment.membership_id, note: isBankTransfer ? reconciliationNote?.trim() : undefined });
    if (!result) throw new AppError({ statusCode: 409, code: "PAYMENT_ALREADY_CONFIRMED", message: "Giao dịch đã được xử lý bởi một xác nhận khác." });
    const paymentLabel = isBankTransfer ? "chuyển khoản" : "tiền mặt";
    await auditService.record({ actorUserId, action: `payment.${status}`, entityType: "payment", entityId: id, summary: status === "paid" ? `Lễ tân đã đối soát ${paymentLabel} và kích hoạt gói tập.` : `Lễ tân xác nhận phiếu thu ${paymentLabel} không thành công.`, reason: isBankTransfer ? reconciliationNote?.trim() : undefined });
    return output(result);
  },
}; }
