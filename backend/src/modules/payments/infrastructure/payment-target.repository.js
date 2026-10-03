import { prisma } from "../../../database.js";

export async function listPaymentTargets(member) {
  const [memberships, enrollments, purchases, rentals, payments] = await Promise.all([
    prisma.member_memberships.findMany({ where: { member_id: member.id, status: "pending_payment", price_vnd_snapshot: { gt: 0n } } }),
    prisma.course_enrollments.findMany({ where: { member_id: member.id, status: "pending_payment", price_vnd_snapshot: { gt: 0n }, OR: [{ payment_expires_at: null }, { payment_expires_at: { gt: new Date() } }] } }),
    prisma.pt_purchases.findMany({ where: { member_id: member.id, status: "pending_payment", price_vnd_snapshot: { gt: 0n } } }),
    member.user_id ? prisma.facility_reservations.findMany({ where: { requester_user_id: member.user_id, status: "approved", payment_state: "unpaid", total_vnd_snapshot: { gt: 0n } } }) : [],
    prisma.payments.findMany({ where: { member_id: member.id, status: { in: ["pending", "paid"] } }, select: { membership_id: true, course_enrollment_id: true, pt_purchase_id: true, facility_reservation_id: true } }),
  ]);
  const [courses, days] = await Promise.all([
    enrollments.length ? prisma.courses.findMany({ where: { id: { in: enrollments.map((item) => item.course_id) } }, select: { id: true, name: true } }) : [],
    rentals.length ? prisma.facility_days.findMany({ where: { id: { in: rentals.map((item) => item.day_id) } } }) : [],
  ]);
  const facilities = days.length ? await prisma.facilities.findMany({ where: { id: { in: days.map((item) => item.facility_id) } }, select: { id: true, name: true } }) : [];
  const courseNames = new Map(courses.map((item) => [item.id, item.name]));
  const facilityNames = new Map(facilities.map((item) => [item.id, item.name]));
  const dayById = new Map(days.map((item) => [item.id, item]));
  const target = (item, targetField, name, amount) => ({ id: item.id, targetField, name, amountVnd: amount.toString() });
  const groups = [
    { field: "membership_id", items: memberships.map((item) => target(item, "membershipId", item.package_name_snapshot, item.price_vnd_snapshot)) },
    { field: "course_enrollment_id", items: enrollments.map((item) => target(item, "courseEnrollmentId", courseNames.get(item.course_id) ?? "Khóa học", item.price_vnd_snapshot)) },
    { field: "pt_purchase_id", items: purchases.map((item) => target(item, "ptPurchaseId", item.package_name_snapshot, item.price_vnd_snapshot)) },
    { field: "facility_reservation_id", items: rentals.map((item) => {
      const day = dayById.get(item.day_id);
      const name = facilityNames.get(day?.facility_id) ?? "Thuê sân/phòng";
      const time = (minute) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      const slot = `${time(item.assigned_start_minute ?? item.requested_start_minute)}–${time(item.assigned_end_minute ?? item.requested_end_minute)}`;
      return target(item, "facilityReservationId", `${name} — ${day?.open_on.toISOString().slice(0, 10) ?? ""} ${slot}`, item.total_vnd_snapshot);
    }) },
  ];
  return groups.flatMap(({ field, items }) => {
    const existing = new Set(payments.map((payment) => payment[field]).filter(Boolean));
    return items.filter((item) => !existing.has(item.id));
  });
}
