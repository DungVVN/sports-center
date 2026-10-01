import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const parsed = new URL(process.env.TEST_DATABASE_URL ?? "");
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !parsed.pathname.startsWith("/sports_center_arch_qa")) {
  throw new Error("Refusing to write outside a localhost sports_center_arch_qa database.");
}
process.env.DATABASE_URL = parsed.href;
const { prisma } = await import("../../src/database.js");
const { createInsightService, insightRepository } = await import("../../src/modules/insights/index.js");
const suffix = randomUUID().slice(0, 8);
const userId = randomUUID();
let memberId;
const paymentIds = [];
try {
  await prisma.users.create({ data: { id: userId, email: `report-${suffix}@architecture.test`, password_hash: "isolated-test-only", display_name: "Report boundary QA", role: "member" } });
  const member = await prisma.members.create({ data: { user_id: userId, member_code: `REPORT-${suffix}`, full_name: "Report boundary QA", phone: `08${suffix.replace(/[a-f]/g, "1")}` } });
  memberId = member.id;
  const query = { period: "custom", from: "2026-10-02", to: "2026-10-02" };
  const service = createInsightService({ repository: insightRepository });
  const baseline = await service.revenue(query);
  for (const [index, paidAt] of ["2026-10-01T16:59:59.999Z", "2026-10-01T17:00:00.000Z", "2026-10-02T16:59:59.999Z", "2026-10-02T17:00:00.000Z"].entries()) {
    const payment = await prisma.payments.create({ data: { transaction_code: `REPORT-${suffix}-${index}`, member_id: memberId, amount_vnd: 100n, method: "cash", status: "paid", recorded_by: userId, paid_at: new Date(paidAt) } });
    paymentIds.push(payment.id);
  }
  const report = await service.revenue(query);
  assert.equal(BigInt(report.paid) - BigInt(baseline.paid), 200n);
  assert.equal(report.payments - baseline.payments, 2);
  assert.equal(report.trend.length, 1);
  assert.equal(report.trend[0].date, "2026-10-02");
  assert.equal(BigInt(report.trend[0].amountVnd) - BigInt(baseline.trend[0].amountVnd), 200n);
  assert.equal((await service.exportReport("revenue", query)).filename, "bao-cao-doanh-thu-2026-10-02-2026-10-02.csv");
  console.log("Isolated PostgreSQL reporting boundaries passed: only the two transactions inside the Vietnam business day are included.");
} finally {
  if (paymentIds.length) await prisma.payments.deleteMany({ where: { id: { in: paymentIds } } });
  if (memberId) await prisma.members.delete({ where: { id: memberId } });
  await prisma.users.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
}
