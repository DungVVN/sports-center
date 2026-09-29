import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is required for the isolated Support integration check.");
const parsed = new URL(testUrl);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !parsed.pathname.startsWith("/sports_center_arch_qa")) {
  throw new Error("Refusing to write outside a localhost sports_center_arch_qa database.");
}
process.env.DATABASE_URL = testUrl;

const { prisma } = await import("../../src/database.js");
const { supportRepository, createSupportService } = await import("../../src/modules/support/index.js");
const { memberRepository } = await import("../../src/modules/members/index.js");
const { notificationPublisher, notificationPreferenceRepository, createNotificationPreferenceService } = await import("../../src/modules/notifications/index.js");
const { auditService } = await import("../../src/shared/audit/audit.service.js");

const ownerId = randomUUID();
const otherId = randomUUID();
const staffId = randomUUID();
const suffix = randomUUID().slice(0, 8);
const createdTickets = [];
const createdMembers = [];
const service = createSupportService({ repository: supportRepository, auditService, memberDirectory: memberRepository, notificationPublisher });

try {
  for (const [id, role, label] of [[ownerId, "member", "owner"], [otherId, "member", "other"], [staffId, "receptionist", "staff"]]) {
    await prisma.users.create({ data: { id, email: `${label}-${suffix}@architecture.test`, password_hash: "isolated-test-only", display_name: label, role } });
  }
  for (const [userId, label] of [[ownerId, "owner"], [otherId, "other"]]) {
    const member = await prisma.members.create({ data: { user_id: userId, member_code: `ARCH-${label}-${suffix}`, full_name: label, phone: `09${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}` } });
    createdMembers.push(member.id);
  }

  const owner = { id: ownerId, role: "member" };
  const other = { id: otherId, role: "member" };
  const staff = { id: staffId, role: "receptionist" };
  const tickets = await Promise.all([
    service.create({ subject: "Kiểm thử kiến trúc A", body: "Nội dung A", priority: "normal" }, owner),
    service.create({ subject: "Kiểm thử kiến trúc B", body: "Nội dung B", priority: "normal" }, owner),
  ]);
  createdTickets.push(...tickets.map((item) => item.id));
  assert.equal(new Set(tickets.map((item) => item.ticket_code)).size, 2);
  assert.equal((await service.list(owner)).filter((item) => createdTickets.includes(item.id)).length, 2);
  assert.equal((await service.list(other)).filter((item) => createdTickets.includes(item.id)).length, 0);
  await assert.rejects(service.detail(tickets[0].id, other), { code: "SUPPORT_TICKET_ACCESS_DENIED" });

  const assigned = await service.assignSelf(tickets[0].id, staff);
  assert.equal(assigned.status, "in_progress");
  const response = await service.respond(tickets[0].id, { body: "Đã tiếp nhận", status: "in_progress" }, staff);
  assert.equal(response.response.body, "Đã tiếp nhận");
  assert.equal(await prisma.notifications.count({ where: { recipient_user_id: ownerId, link_path: `/support/${tickets[0].id}` } }), 1);
  assert.equal(await prisma.audit_logs.count({ where: { entity_id: tickets[0].id } }), 3);

  const preferences = createNotificationPreferenceService({ repository: notificationPreferenceRepository });
  assert.equal((await preferences.get(owner)).email_enabled, true);
  assert.equal((await preferences.save({ emailEnabled: false }, owner)).email_enabled, false);
  assert.equal((await preferences.get(owner)).push_enabled, false);
  console.log("Isolated PostgreSQL Support create/scope/assign/respond/notification/audit/preferences passed.");
} finally {
  await prisma.notification_preferences.deleteMany({ where: { user_id: { in: [ownerId, otherId, staffId] } } });
  await prisma.notifications.deleteMany({ where: { recipient_user_id: { in: [ownerId, otherId, staffId] } } });
  await prisma.audit_logs.deleteMany({ where: { actor_user_id: { in: [ownerId, otherId, staffId] } } });
  await prisma.support_ticket_responses.deleteMany({ where: { ticket_id: { in: createdTickets } } });
  await prisma.support_tickets.deleteMany({ where: { id: { in: createdTickets } } });
  await prisma.members.deleteMany({ where: { id: { in: createdMembers } } });
  await prisma.users.deleteMany({ where: { id: { in: [ownerId, otherId, staffId] } } });
  await prisma.$disconnect();
}
