import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is required.");
const target = new URL(testUrl);
if (!["localhost", "127.0.0.1"].includes(target.hostname) || !/^\/sports_center_arch_qa_[a-z0-9_]+$/.test(target.pathname)) {
  throw new Error("Benchmark writes require a dedicated localhost architecture QA database.");
}
process.env.DATABASE_URL = testUrl;
const { prisma } = await import("../../src/database.js");
const { memberRepository, createMemberService } = await import("../../src/modules/members/index.js");
const suffix = randomUUID().slice(0, 8);
const ids = Array.from({ length: 500 }, () => randomUUID());

// Reproduce the original list's per-member contact reads as the baseline.
async function baseline() {
  const items = await memberRepository.listWithOverview();
  return Promise.all(items.map(async ({ member }) => ({
    id: member.id,
    contacts: (await memberRepository.contacts(member.id)).map((item) => ({
      id: item.id, fullName: item.full_name, relationship: item.relationship, phone: item.phone, isPrimary: item.is_primary,
    })),
  })));
}
const service = createMemberService({ repository: memberRepository });
async function batched() {
  return (await service.list()).map(({ id, contacts }) => ({ id, contacts }));
}
async function sample(operation) {
  await operation(); // Warm the connection pool before collecting timings.
  const samples = [];
  for (let index = 0; index < 7; index += 1) {
    const start = performance.now();
    await operation();
    samples.push(performance.now() - start);
  }
  samples.sort((left, right) => left - right);
  return { medianMs: Number(samples[3].toFixed(2)), p95Ms: Number(samples[6].toFixed(2)) };
}

try {
  await prisma.members.createMany({ data: ids.map((id, index) => ({
    id, member_code: `BATCH-${suffix}-${index}`, full_name: `Batch QA ${index}`, phone: `batch-${suffix}-${index}`,
  })) });
  await prisma.member_emergency_contacts.createMany({ data: ids.flatMap((member_id) => [
    { member_id, full_name: "Primary QA contact", relationship: "Family", phone: "0900000001", is_primary: true },
    { member_id, full_name: "Secondary QA contact", relationship: "Family", phone: "0900000002", is_primary: false },
  ]) });
  const expected = await baseline();
  assert.deepEqual(await batched(), expected);
  assert.equal(expected.filter((member) => ids.includes(member.id)).length, 500);
  console.log(JSON.stringify({
    scope: "Local PostgreSQL repository/service reads; excludes HTTP, UI and production load",
    members: expected.length,
    seededMembers: 500,
    contactQueriesBefore: expected.length,
    contactQueriesAfter: 1,
    before: await sample(baseline),
    after: await sample(batched),
    responseContactsUnchanged: true,
  }, null, 2));
} finally {
  await prisma.member_emergency_contacts.deleteMany({ where: { member_id: { in: ids } } });
  await prisma.members.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
}
