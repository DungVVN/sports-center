import { env } from "../../config/env.js";

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function loginUrl(config) {
  const frontendOrigin = config.corsOrigins?.find((origin) => origin.startsWith("https://")) ?? config.corsOrigins?.[0];
  return frontendOrigin ? `${frontendOrigin.replace(/\/$/, "")}/` : null;
}

export function createStaffCredentialsDeliveryService({ config = env, fetchImpl = fetch, logger = console } = {}) {
  return {
    async deliver({ recipient, fullName, temporaryPassword }) {
      if (config.verificationDeliveryMode !== "provider" || !config.resendApiKey || !config.resendFromEmail) {
        return { delivered: false, configured: false };
      }

      const login = loginUrl(config);
      const loginText = login ? `\n\nĐăng nhập lần đầu: ${login}\nSau khi đăng nhập, vào Hồ sơ > Đổi mật khẩu để đặt mật khẩu mới.` : "";
      const loginButton = login ? `<p><a href="${escapeHtml(login)}" style="display:inline-block;padding:12px 18px;background:#2563eb;border-radius:6px;color:#ffffff;text-decoration:none;font-weight:600">Đăng nhập lần đầu</a></p><p>Sau khi đăng nhập, vào <strong>Hồ sơ → Đổi mật khẩu</strong> để đặt mật khẩu mới.</p>` : "";

      try {
        const response = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${config.resendFromName} <${config.resendFromEmail}>`,
            to: [recipient],
            subject: "Tài khoản nhân viên Kinetic Sports",
            text: `Chào ${fullName},\n\nTài khoản Kinetic Sports của bạn đã được tạo.\nEmail đăng nhập: ${recipient}\nMật khẩu tạm thời: ${temporaryPassword}${loginText}\n\nKhông chia sẻ email này với bất kỳ ai.`,
            html: `<p>Chào ${escapeHtml(fullName)},</p><p>Tài khoản Kinetic Sports của bạn đã được tạo.</p><p><strong>Email đăng nhập:</strong> ${escapeHtml(recipient)}<br><strong>Mật khẩu tạm thời:</strong> ${escapeHtml(temporaryPassword)}</p>${loginButton}<p>Không chia sẻ email này với bất kỳ ai.</p>`,
          }),
        });

        if (!response.ok) {
          logger.error("Staff credential email delivery failed.", { status: response.status });
          return { delivered: false, configured: true };
        }
      } catch (error) {
        logger.error("Staff credential email delivery failed.", { error: error instanceof Error ? error.message : "Unknown error" });
        return { delivered: false, configured: true };
      }

      return { delivered: true, configured: true };
    },
  };
}

export const staffCredentialsDeliveryService = createStaffCredentialsDeliveryService();
