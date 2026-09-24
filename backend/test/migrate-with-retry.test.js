import { describe, expect, it } from "vitest";
import { migrationDatabaseUrl } from "../scripts/migrate-with-retry.js";

describe("migrationDatabaseUrl", () => {
  it("uses the matching direct Neon endpoint for a pooler migration URL", () => {
    expect(migrationDatabaseUrl({ MIGRATE_DATABASE_URL: "postgresql://owner:password@ep-example-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" }))
      .toBe("postgresql://owner:password@ep-example.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require");
  });

  it("preserves an already-direct migration URL", () => {
    const url = "postgresql://owner:password@ep-example.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
    expect(migrationDatabaseUrl({ MIGRATE_DATABASE_URL: url })).toBe(url);
  });
});
