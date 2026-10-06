import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "../src/shared/auth/password.js";

describe("new password hashing", () => {
  it("supports passwords up to exactly 72 UTF-8 bytes", async () => {
    const password = `Aa1${"é".repeat(34)}x`;
    expect(Buffer.byteLength(password, "utf8")).toBe(72);
    const hash = await hashPassword(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword(`${password.slice(0, -1)}y`, hash)).resolves.toBe(false);
  });

  it.each([`Aa1${"é".repeat(35)}`, `Aa1${"😀".repeat(18)}`, "x".repeat(73)])("rejects passwords that bcrypt would silently truncate", async (password) => {
    expect(bcrypt.truncates(password)).toBe(true);
    await expect(hashPassword(password)).rejects.toMatchObject({ statusCode: 422, code: "PASSWORD_TOO_LONG" });
  });

  it("preserves verification of legacy hashes without rehashing stored passwords", async () => {
    const password = `Aa1${"é".repeat(35)}`;
    const legacyHash = await bcrypt.hash(password, 4);
    await expect(verifyPassword(password, legacyHash)).resolves.toBe(true);
  });
});
