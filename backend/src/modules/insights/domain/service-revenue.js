const services = [["membership", "Gói hội viên"], ["course", "Khóa có hướng dẫn"], ["pt", "Huấn luyện cá nhân"], ["facility", "Thuê sân/phòng"], ["other", "Khoản thu khác"]];

export function serviceRevenue(payments, refunds = []) {
  const totals = new Map(services.map(([type, name]) => [type, { type, name, amount: 0n, refunded: 0n, payments: 0, requiresReview: 0 }]));
  for (const payment of payments) {
    const type = payment.membership_id ? "membership" : payment.course_enrollment_id ? "course" : payment.pt_purchase_id ? "pt" : payment.facility_reservation_id ? "facility" : "other";
    const total = totals.get(type);
    total.amount += payment.amount_vnd;
    total.payments += 1;
    if (payment.fulfillment_error) total.requiresReview += 1;
  }
  for (const refund of refunds) {
    const payment = refund.payments;
    const type = payment.course_enrollment_id ? "course" : payment.pt_purchase_id ? "pt" : payment.facility_reservation_id ? "facility" : "other";
    totals.get(type).refunded += refund.amount_vnd;
  }
  return [...totals.values()].map(({ amount, refunded, ...item }) => ({ ...item, grossVnd: amount.toString(), refundedVnd: refunded.toString(), amountVnd: (amount - refunded).toString() }));
}
