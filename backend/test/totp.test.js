import { describe, expect, it } from "vitest";
import { buildTotpUri, decryptTotpSecret, encryptTotpSecret, verifyTotp } from "../src/shared/auth/totp.js";

describe("TOTP", () => {
  it("verifies the RFC 6238 SHA-1 vector using the six-digit API format", () => {
    expect(verifyTotp({ secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", code: "287082", now: 59_000 })).toBe(true);
    expect(verifyTotp({ secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", code: "287083", now: 59_000 })).toBe(false);
  });

  it("encrypts a stored secret and emits a standards-compatible Authenticator URI", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    expect(decryptTotpSecret(encryptTotpSecret(secret))).toBe(secret);
    expect(buildTotpUri({ secret, email: "manager@example.com" })).toContain("secret=JBSWY3DPEHPK3PXP");
  });
});
