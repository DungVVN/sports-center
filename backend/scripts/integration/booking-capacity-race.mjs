import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is required for isolated booking race checks.");
const parsed = new URL(testUrl);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !parsed.pathname.startsWith("/sports_center_arch_qa")) {
  throw new Error("Refusing to write outside a localhost sports_center_arch_qa database.");
}
process.env.DATABASE_URL = testUrl;

const { prisma } = await import("../../src/database.js");
const { bookingRepository } = await import("../../src/modules/bookings/index.js");
const ids = { coach: randomUUID(), memberUsers: Array.from({ length: 5 }, () => randomUUID()), members: [], memberships: [], package: null, room: null, class: null };
const suffix = randomUUID().slice(0, 8);

try {
  await prisma.users.create({ data: { id: ids.coach, email: `booking-coach-${suffix}@architecture.test`, password_hash: "isolated-test-only", display_name: "Booking coach QA", role: "coach" } });
  for (const [index, userId] of ids.memberUsers.entries()) {
    await prisma.users.create({ data: { id: userId, email: `booking-member-${index}-${suffix}@architecture.test`, password_hash: "isolated-test-only", display_name: `Booking member ${index}`, role: "member" } });
    const member = await prisma.members.create({ data: { user_id: userId, member_code: `BOOK-QA-${index}-${suffix}`, full_name: `Booking member ${index}`, phone: `07${index}${suffix.replace(/[a-f]/g, "1").padEnd(7, "0").slice(0, 7)}` } });
    ids.members.push(member.id);
  }
  const membershipPackage = await prisma.membership_packages.create({ data: { code: `BOOK-PACK-${suffix}`, name: `Booking package ${suffix}`, price_vnd: BigInt(100000), duration_days: 30, tier_rank: 1_000_000 + Math.floor(Math.random() * 1_000_000) } });
  ids.package = membershipPackage.id;
  await prisma.membership_package_entitlements.create({ data: { package_id: ids.package, entitlement: "group_class_booking" } });
  const startsOn = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const expiresOn = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000);
  for (const memberId of ids.members) {
    const membership = await prisma.member_memberships.create({ data: { member_id: memberId, package_id: membershipPackage.id, package_name_snapshot: membershipPackage.name, price_vnd_snapshot: membershipPackage.price_vnd, status: "active", starts_on: startsOn, expires_on: expiresOn, grace_expires_at: new Date(expiresOn.getTime() + 72 * 60 * 60 * 1000) } });
    ids.memberships.push(membership.id);
  }
  const room = await prisma.rooms.create({ data: { code: `BOOK-ROOM-${suffix}`, name: `Booking room ${suffix}`, capacity: 1 } });
  ids.room = room.id;
  const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const session = await prisma.class_sessions.create({ data: { code: `BOOK-CLASS-${suffix}`, name: `Booking class ${suffix}`, type: "group", coach_user_id: ids.coach, room_id: ids.room, starts_at: startsAt, ends_at: new Date(startsAt.getTime() + 60 * 60 * 1000), capacity: 1, status: "published" } });
  ids.class = session.id;
  const results = await Promise.all(ids.members.slice(0, 2).map((memberId, index) => bookingRepository.createWithCapacity({ bookingCode: `BOOK-RACE-${index}-${suffix}`, memberId, classId: ids.class, bookedBy: ids.memberUsers[index] })));
  assert.deepEqual(results.map((result) => result.booking.status).sort(), ["confirmed", "waitlisted"]);
  assert.equal(await prisma.bookings.count({ where: { class_session_id: ids.class, status: "confirmed" } }), 1);
  const duplicate = await bookingRepository.createWithCapacity({ bookingCode: `BOOK-DUP-${suffix}`, memberId: ids.members[0], classId: ids.class, bookedBy: ids.memberUsers[0] });
  assert.equal(duplicate.duplicate, true);
  assert.equal(await prisma.bookings.count({ where: { class_session_id: ids.class } }), 2);
  for (const index of [2, 3]) await bookingRepository.createWithCapacity({ bookingCode: `BOOK-WAIT-${index}-${suffix}`, memberId: ids.members[index], classId: ids.class, bookedBy: ids.memberUsers[index] });
  const confirmed = results.find((result) => result.booking.status === "confirmed").booking;

  // A notification failure must roll back both cancellation and promotion.
  await prisma.$executeRaw`ALTER TABLE notifications ADD CONSTRAINT qa_booking_notification_failure CHECK (title <> 'Đã có chỗ trong lớp')`;
  try {
    await assert.rejects(bookingRepository.cancelAndPromote(confirmed.id, ids.class, "Rollback QA"));
    assert.equal((await prisma.bookings.findUnique({ where: { id: confirmed.id } })).status, "confirmed");
    assert.equal(await prisma.bookings.count({ where: { class_session_id: ids.class, status: "waitlisted" } }), 3);
  } finally {
    await prisma.$executeRaw`ALTER TABLE notifications DROP CONSTRAINT qa_booking_notification_failure`;
  }

  const cancelled = await Promise.all([
    bookingRepository.cancelAndPromote(confirmed.id, ids.class, "Concurrent cancel A"),
    bookingRepository.cancelAndPromote(confirmed.id, ids.class, "Concurrent cancel B"),
  ]);
  assert.equal(cancelled.filter(Boolean).length, 1);
  assert.equal(cancelled.filter((result) => result?.promotedBookingId).length, 1);
  assert.equal(await prisma.bookings.count({ where: { class_session_id: ids.class, status: "confirmed" } }), 1);
  assert.equal(await prisma.bookings.count({ where: { class_session_id: ids.class, status: "waitlisted" } }), 2);
  assert.equal(await bookingRepository.promoteWaitlisted(ids.class), null);

  const nextConfirmed = await prisma.bookings.findFirst({ where: { class_session_id: ids.class, status: "confirmed" } });
  await Promise.all([
    bookingRepository.cancelAndPromote(nextConfirmed.id, ids.class, "Cancel alongside new booking"),
    bookingRepository.createWithCapacity({ bookingCode: `BOOK-NEW-${suffix}`, memberId: ids.members[4], classId: ids.class, bookedBy: ids.memberUsers[4] }),
  ]);
  assert.equal(await prisma.bookings.count({ where: { class_session_id: ids.class, status: "confirmed" } }), 1);
  console.log("Isolated PostgreSQL booking checks passed: capacity, duplicates, atomic rollback, duplicate cancellation and cancellation alongside a new booking.");
} finally {
  await prisma.notifications.deleteMany({ where: { recipient_user_id: { in: ids.memberUsers } } });
  if (ids.class) await prisma.bookings.deleteMany({ where: { class_session_id: ids.class } });
  if (ids.class) await prisma.class_sessions.delete({ where: { id: ids.class } });
  if (ids.room) await prisma.rooms.delete({ where: { id: ids.room } });
  if (ids.memberships.length) await prisma.member_memberships.deleteMany({ where: { id: { in: ids.memberships } } });
  if (ids.package) await prisma.membership_packages.delete({ where: { id: ids.package } });
  if (ids.members.length) await prisma.members.deleteMany({ where: { id: { in: ids.members } } });
  await prisma.users.deleteMany({ where: { id: { in: [ids.coach, ...ids.memberUsers] } } });
  await prisma.$disconnect();
}
