import { env } from "../../../config/env.js";
import { emailWebLink } from "../../../shared/email/web-link.js";

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function message(notification, config) {
  const link = notification.link_path ? emailWebLink(notification.link_path, config) : null;
  return {
    from: `${env.resendFromName} <${env.resendFromEmail}>`,
    to: [notification.recipient.email],
    subject: `[Kinetic Sports] ${notification.title}`,
    text: `${notification.title}\n\n${notification.body}${link ? `\n\nXem chi tiết: ${link}` : ""}`,
    html: `<h2>${escapeHtml(notification.title)}</h2><p>${escapeHtml(notification.body)}</p>${link ? `<p><a href="${escapeHtml(link)}">Xem chi tiết</a></p>` : ""}`,
  };
}

export function createNotificationEmailDeliveryService({ repository, config = env, fetchImpl = fetch, now = () => new Date(), logger = console } = {}) {
  return {
    async deliverPending({ limit = 50 } = {}) {
      if (config.verificationDeliveryMode !== "provider" || !config.resendApiKey || !config.resendFromEmail) return { configured: false, delivered: 0, skipped: 0, failed: 0 };
      const startedAt = now();
      const staleBefore = new Date(startedAt.getTime() - 10 * 60_000);
      const pending = await repository.pending({ staleBefore, limit });
      let delivered = 0; let skipped = 0; let failed = 0;
      for (const notification of pending) {
        const claimed = await repository.claim({ id: notification.id, staleBefore, lockedAt: startedAt });
        if (claimed.count !== 1) continue;
        if (!notification.recipient || !notification.emailEnabled) {
          await repository.skipped(notification.id, now());
          skipped += 1;
          continue;
        }
        try {
          const response = await fetchImpl("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(message(notification, config)) });
          if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}`);
          await repository.delivered(notification.id, now());
          delivered += 1;
        } catch (error) {
          await repository.failed(notification.id, error instanceof Error ? error.message : "Email delivery failed");
          logger.error("Notification email delivery failed.", { notificationId: notification.id });
          failed += 1;
        }
      }
      return { configured: true, delivered, skipped, failed };
    },
  };
}
