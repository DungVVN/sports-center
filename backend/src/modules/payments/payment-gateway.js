import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";

const supportedProviders = new Set(["vnpay", "momo", "zalopay"]);
const signatureFor = (provider, transactionCode, status, amount) => createHmac("sha256", env.paymentWebhookSecret).update(`${provider}|${transactionCode}|${status}|${amount}`).digest("hex");

export function sandboxPaymentUrl(provider, transactionCode, amount) {
  return `${env.publicApiOrigin}${env.apiBasePath}/payments/sandbox/${provider}/${transactionCode}?amount=${amount}&signature=${signatureFor(provider, transactionCode, "paid", amount)}`;
}

export function verifySandboxCallback({ provider, transactionCode, status, amount, signature }) {
  if (!supportedProviders.has(provider) || !["paid", "failed"].includes(status)) return false;
  const expected = Buffer.from(signatureFor(provider, transactionCode, status, amount));
  const received = Buffer.from(signature ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
