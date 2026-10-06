import { describe, expect, it, vi } from "vitest";
import { readBusinessManifest, verifyBusinessManifest } from "../scripts/backup-manifest.js";

describe("backup business verification", () => {
  const manifest = { members: { rows: "2", digest1: "10", digest2: "20" }, payments: { rows: "3", digest1: "30", digest2: "40" } };
  it("rejects missing rows and changed content even when PostgreSQL responds", () => {
    expect(() => verifyBusinessManifest(manifest, structuredClone(manifest))).not.toThrow();
    expect(() => verifyBusinessManifest(manifest, { ...manifest, payments: { ...manifest.payments, rows: "2" } })).toThrow("does not match");
    expect(() => verifyBusinessManifest(manifest, { ...manifest, payments: { ...manifest.payments, digest2: "41" } })).toThrow("does not match");
  });
  it("refuses verification of a responsive database with no business schema", async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [{ table_name: "unrelated" }] }) };
    await expect(readBusinessManifest(client)).rejects.toThrow("business schema");
  });
});
