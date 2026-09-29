import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is required for isolated payment race checks.");
const parsed = new URL(testUrl);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !parsed.pathname.startsWith("/sports_center_arch_qa")) {
  throw new Error("Refusing to write outside a localhost sports_center_arch_qa database.");
}
process.env.DATABASE_URL = testUrl;

const { prisma } = await import("../../src/database.js");
const { paymentRepository, createPaymentService } = await import("../../src/modules/payments/index.js");
const staffId = randomUUID();
const memberUserId = randomUUID();
const suffix = randomUUID().slice(0, 8);
const orderCode = BigInt(Date.now());
let memberId;
let paymentId;

try {
  await prisma.users.create({ data: { id: staffId, email: `payment-staff-${suffix}@architecture.test`, password_hash: "isolated-test-only", display_name: "Payment QA", role: "receptionist" } });
  await prisma.users.create({ data: { id: memberUserId, email: `payment-member-${suffix}@architecture.test`, password_hash: "isolated-test-only", display_name: "Payment member QA", role: "member" } });
  const member = await prisma.members.create({ data: { user_id: memberUserId, member_code: `PAY-QA-${suffix}`, full_name: "Payment member QA", phone: `08${suffix.replace(/[a-f]/g, "1").padEnd(8, "0").slice(0, 8)}` } });
  memberId = member.id;
  const payment = await prisma.payments.create({ data: { transaction_code: `PAY-QA-${suffix}`, member_id: memberId, amount_vnd: BigInt(100000), method: "online", provider: "payos", provider_order_code: orderCode, recorded_by: staffId } });
  paymentId = payment.id;
  const service = createPaymentService({ repository: paymentRepository, auditService: { record: async () => {} }, payosGateway: {
    verifyWebhook: async () => ({ orderCode: orderCode.toString(), amount: 100000, code: "00", transactionDateTime: new Date().toISOString() }),
  } });
  const responses = await Promise.all([service.payosCallback({}), service.payosCallback({})]);
  assert.equal((await prisma.payments.findUnique({ where: { id: paymentId } })).status, "paid");
  assert.equal(await prisma.payment_events.count({ where: { payment_id: paymentId, event_type: "payos_webhook" } }), 1);
  assert.deepEqual(responses.map((item) => item.status), ["paid", "paid"]);
  console.log("Isolated PostgreSQL PayOS duplicate callback race passed: one paid transition/event, both responses paid.");
} finally {
  if (paymentId) {
    await prisma.payment_events.deleteMany({ where: { payment_id: paymentId } });
    await prisma.payments.delete({ where: { id: paymentId } });
  }
  if (memberId) await prisma.members.delete({ where: { id: memberId } });
  await prisma.users.deleteMany({ where: { id: { in: [staffId, memberUserId] } } });
  await prisma.$disconnect();
}
