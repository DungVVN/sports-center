import { describe, expect, it } from "vitest";
import { normalizeDatabaseConnectionString } from "../src/database-url.js";

describe("normalizeDatabaseConnectionString", () => {
  it("uses verify-full for legacy pg SSL aliases", () => {
    const result = normalizeDatabaseConnectionString(
      "postgresql://user:password@example.com/neondb?sslmode=require&channel_binding=require",
    );

    expect(new URL(result).searchParams.get("sslmode")).toBe("verify-full");
    expect(new URL(result).searchParams.get("channel_binding")).toBe("require");
  });

  it("preserves an explicit SSL mode", () => {
    const result = normalizeDatabaseConnectionString(
      "postgresql://user:password@example.com/neondb?sslmode=verify-full",
    );

    expect(result).toContain("sslmode=verify-full");
  });
});
