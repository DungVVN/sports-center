import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDatabaseClient } from "../src/database.js";
import { assignmentRepository } from "../src/modules/assignments/index.js";
import { withRuntime } from "../src/shared/runtime/request-context.js";

const configuredUrl = process.env.ASSIGNMENT_TEST_DATABASE_URL;
describe.skipIf(!configuredUrl)("coach assignment PostgreSQL date ranges", () => {
  it("rejects duplicate dates and serializes concurrent changes without corrupting history", async () => {
    const target = new URL(configuredUrl);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || !/sports_center_(arch_qa|.*_test)/.test(target.pathname)) throw new Error("A dedicated local QA database is required.");
    const client = createDatabaseClient(configuredUrl);
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const suffix = randomUUID().slice(0, 8);
    let member;
    try {
      await client.users.createMany({ data: ids.map((id, index) => ({ id, email: `assignment-${index}-${suffix}@localhost.test`, display_name: "Assignment QA", password_hash: "isolated-fixture", role: index === 0 ? "member" : "coach", status: "active" })) });
      member = await client.members.create({ data: { user_id: ids[0], member_code: `ASN-${suffix}`, full_name: "Assignment QA", phone: `09${Date.now().toString().slice(-8)}` } });
      const run = (coachId, date) => withRuntime({ database: client }, () => assignmentRepository.assign(member.id, coachId, ids[1], new Date(date), "Isolated QA"));
      const first = await run(ids[1], "2099-01-01");
      await expect(run(ids[2], "2099-01-01")).rejects.toMatchObject({ statusCode: 409, code: "COACH_ASSIGNMENT_DATE_CONFLICT" });
      expect((await client.member_coach_assignments.findUnique({ where: { id: first.id } })).effective_to).toBeNull();
      const changes = await Promise.allSettled([run(ids[1], "2099-01-02"), run(ids[2], "2099-01-02")]);
      expect(changes.filter((item) => item.status === "fulfilled")).toHaveLength(1);
      expect(changes.find((item) => item.status === "rejected").reason).toMatchObject({ code: "COACH_ASSIGNMENT_DATE_CONFLICT" });
      const history = await client.member_coach_assignments.findMany({ where: { member_id: member.id }, orderBy: { effective_from: "asc" } });
      expect(history).toHaveLength(2);
      expect(history[0].effective_to.toISOString().slice(0, 10)).toBe("2099-01-01");
      expect(history[1].effective_to).toBeNull();
    } finally {
      if (member) {
        await client.member_coach_assignments.deleteMany({ where: { member_id: member.id } });
        await client.members.delete({ where: { id: member.id } });
      }
      await client.users.deleteMany({ where: { id: { in: ids } } });
      await client.$disconnect();
    }
  }, 30000);
});
