import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is required for isolated facility race checks.");
const parsed = new URL(testUrl);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !parsed.pathname.startsWith("/sports_center_arch_qa")) {
  throw new Error("Refusing to write outside a localhost sports_center_arch_qa database.");
}
process.env.DATABASE_URL = testUrl;

const { prisma } = await import("../../src/database.js");
const { facilityRepository } = await import("../../src/modules/facilities/index.js");
const requesterId = randomUUID();
const reviewerId = randomUUID();
const suffix = randomUUID().slice(0, 8);
const ids = { type: null, facility: null, day: null, reservation: null };

try {
  await prisma.users.create({ data: { id: requesterId, email: `facility-member-${suffix}@architecture.test`, password_hash: "isolated-test-only", display_name: "Facility member QA", role: "member" } });
  await prisma.users.create({ data: { id: reviewerId, email: `facility-reviewer-${suffix}@architecture.test`, password_hash: "isolated-test-only", display_name: "Facility reviewer QA", role: "receptionist" } });
  const type = await prisma.facility_types.create({ data: { name: `Facility QA ${suffix}` } });
  ids.type = type.id;
  const facility = await prisma.facilities.create({ data: { type_id: ids.type, name: `Court QA ${suffix}`, open_minute: 480, close_minute: 1320 } });
  ids.facility = facility.id;
  const day = await prisma.facility_days.create({ data: { facility_id: ids.facility, open_on: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), created_by: reviewerId } });
  ids.day = day.id;
  const input = { dayId: ids.day, requesterUserId: requesterId, startMinute: 600, endMinute: 660, participantCount: 2, phone: "0900000000", actorUserId: requesterId };
  const attempts = await Promise.allSettled([facilityRepository.request(input), facilityRepository.request(input)]);
  const created = attempts.filter((attempt) => attempt.status === "fulfilled" && attempt.value.kind === "created");
  assert.equal(created.length, 1);
  assert.ok(attempts.every((attempt) => attempt.status === "fulfilled" || attempt.reason?.code === "P2002"));
  ids.reservation = created[0].value.item.id;
  assert.equal(await prisma.facility_reservations.count({ where: { day_id: ids.day } }), 1);
  const decisions = await Promise.all([
    facilityRepository.review({ id: ids.reservation, approved: true, startMinute: 600, endMinute: 660, reason: null, actorUserId: reviewerId }),
    facilityRepository.review({ id: ids.reservation, approved: true, startMinute: 600, endMinute: 660, reason: null, actorUserId: reviewerId }),
  ]);
  assert.deepEqual(decisions.map((item) => item.kind).sort(), ["invalid", "updated"]);
  assert.equal(await prisma.audit_logs.count({ where: { entity_id: ids.reservation, action: "facility.reservation.approved" } }), 1);
  console.log("Isolated PostgreSQL facility races passed: one pending request and one approval/audit event.");
} finally {
  if (ids.reservation) await prisma.audit_logs.deleteMany({ where: { entity_id: ids.reservation } });
  if (ids.day) await prisma.facility_reservations.deleteMany({ where: { day_id: ids.day } });
  if (ids.day) await prisma.facility_days.delete({ where: { id: ids.day } });
  if (ids.facility) await prisma.facilities.delete({ where: { id: ids.facility } });
  if (ids.type) await prisma.facility_types.delete({ where: { id: ids.type } });
  await prisma.users.deleteMany({ where: { id: { in: [requesterId, reviewerId] } } });
  await prisma.$disconnect();
}
