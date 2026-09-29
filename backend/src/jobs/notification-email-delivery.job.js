import { notificationEmailDeliveryRepository, createNotificationEmailDeliveryService } from "../modules/notifications/index.js";

const service = createNotificationEmailDeliveryService({ repository: notificationEmailDeliveryRepository });

export async function runNotificationEmailDeliveryJob() {
  return service.deliverPending();
}
