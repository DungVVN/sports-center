import { PayOS } from "@payos/node";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/app-error.js";

function client() {
  if (!env.payosClientId || !env.payosApiKey || !env.payosChecksumKey) {
    throw new AppError({ statusCode: 503, code: "PAYOS_NOT_CONFIGURED", message: "Cổng PayOS chưa được cấu hình trong môi trường này." });
  }
  return new PayOS({ clientId: env.payosClientId, apiKey: env.payosApiKey, checksumKey: env.payosChecksumKey });
}

function frontendOrigin() {
  const origin = env.corsOrigins[0];
  if (!origin?.startsWith("https://")) throw new AppError({ statusCode: 503, code: "PAYOS_RETURN_URL_NOT_CONFIGURED", message: "Chưa cấu hình HTTPS frontend origin cho PayOS." });
  return origin;
}

export async function createPayosPaymentLink({ amountVnd, orderCode, transactionCode }) {
  try {
    const link = await client().paymentRequests.create({
      orderCode: Number(orderCode),
      amount: Number(amountVnd),
      description: `Kinetic ${transactionCode}`.slice(0, 25),
      items: [{ name: "Gói tập Kinetic Sports", quantity: 1, price: Number(amountVnd) }],
      returnUrl: `${frontendOrigin()}/?payment=${encodeURIComponent(transactionCode)}`,
      cancelUrl: `${frontendOrigin()}/?payment=${encodeURIComponent(transactionCode)}&cancelled=1`,
    });
    return { checkoutUrl: link.checkoutUrl, paymentLinkId: link.paymentLinkId, qrCode: link.qrCode };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError({ statusCode: 502, code: "PAYOS_CREATE_LINK_FAILED", message: "Không thể tạo liên kết thanh toán PayOS. Vui lòng thử lại." });
  }
}

export async function verifyPayosWebhook(payload) {
  try {
    return await client().webhooks.verify(payload);
  } catch {
    throw new AppError({ statusCode: 401, code: "PAYOS_WEBHOOK_INVALID", message: "Webhook PayOS không hợp lệ." });
  }
}
