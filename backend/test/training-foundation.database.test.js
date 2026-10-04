import { describe, expect, it } from "vitest";
import { Client } from "pg";
import { verifyTrainingFoundation } from "./helpers/training-foundation-cases.js";

const configuredUrl = process.env.TRAINING_FOUNDATION_TEST_DATABASE_URL;

describe.skipIf(!configuredUrl)("training evidence/assessment PostgreSQL foundation", () => {
  it("enforces evidence, ownership, consent, professional scope and immutable actual outcomes", async () => {
    const url = new URL(configuredUrl);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !/training_(test|verify)/.test(url.pathname)) {
      throw new Error("Database tests require an explicitly configured local training test database.");
    }
    const client = new Client({ connectionString: configuredUrl, connectionTimeoutMillis: 10000 });
    await client.connect();
    try {
      const cases = await verifyTrainingFoundation(client);
      expect(cases.length).toBeGreaterThanOrEqual(51);
      expect(cases.every((test) => test.passed)).toBe(true);
    } finally { await client.end(); }
  }, 30000);
});
