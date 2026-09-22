import { notificationEmailDeliveryRepository } from "../modules/notifications/notification-email-delivery.repository.js";
import { createNotificationEmailDeliveryService } from "../modules/notifications/notification-email-delivery.service.js";

const service = createNotificationEmailDeliveryService({ repository: notificationEmailDeliveryRepository });

export async function runNotificationEmailDeliveryJob() {
  return service.deliverPending();
}
