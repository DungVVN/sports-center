import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { env } from "../src/config/env.js";
import { createSessionToken, readSessionToken } from "../src/shared/auth/session-token.js";

describe("session token verification", () => {
  it("accepts an unexpired token issued by this service", async () => {
    const token = await createSessionToken({ sessionId: "session-1", userId: "user-1", expiresAt: new Date(Date.now() + 60_000) });
    await expect(readSessionToken(token)).resolves.toEqual({ sessionId: "session-1", userId: "user-1" });
  });

  it.each(["HS384", "HS512"])("rejects a signed token using %s", async (algorithm) => {
    const token = await new SignJWT({ sid: "session-1" }).setProtectedHeader({ alg: algorithm })
      .setSubject("user-1").setIssuedAt().setExpirationTime("1m").sign(new TextEncoder().encode(env.authJwtSecret));
    await expect(readSessionToken(token)).rejects.toMatchObject({ statusCode: 401, code: "UNAUTHENTICATED" });
  });

  it.each(["exp", "iat", "sub", "sid"])("rejects a signed token missing required %s", async (claim) => {
    const payload = { sid: "session-1", sub: "user-1", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 };
    delete payload[claim];
    const token = await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode(env.authJwtSecret));
    await expect(readSessionToken(token)).rejects.toMatchObject({ statusCode: 401, code: "UNAUTHENTICATED" });
  });

  it("rejects expired and tampered tokens", async () => {
    const expired = await createSessionToken({ sessionId: "session-1", userId: "user-1", expiresAt: new Date(Date.now() - 60_000) });
    await expect(readSessionToken(expired)).rejects.toMatchObject({ statusCode: 401 });
    const valid = await createSessionToken({ sessionId: "session-1", userId: "user-1", expiresAt: new Date(Date.now() + 60_000) });
    const [header, payload, signature] = valid.split(".");
    await expect(readSessionToken(`${header}.${payload}.${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`)).rejects.toMatchObject({ statusCode: 401 });
  });
});
