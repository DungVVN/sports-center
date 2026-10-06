import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

const jwtSecret = new TextEncoder().encode(env.authJwtSecret);

export async function createSessionToken({ sessionId, userId, expiresAt }) {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(jwtSecret);
}

export async function readSessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, jwtSecret, { algorithms: ["HS256"], requiredClaims: ["sub", "sid", "exp", "iat"] });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      throw new Error("Session token claims are missing.");
    }
    return { sessionId: payload.sid, userId: payload.sub };
  } catch {
    throw new AppError({ statusCode: 401, code: "UNAUTHENTICATED", message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
  }
}

export function generateVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashVerificationCode(code) {
  return createHmac("sha256", env.verificationCodeSecret).update(code).digest("hex");
}

export function verificationCodeMatches(code, codeHash) {
  const suppliedHash = hashVerificationCode(code);
  const supplied = Buffer.from(suppliedHash, "hex");
  const stored = Buffer.from(codeHash, "hex");
  return supplied.length === stored.length && timingSafeEqual(supplied, stored);
}
