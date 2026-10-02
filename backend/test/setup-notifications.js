import { vi } from "vitest";
// HTTP tests inject business services; isolate the additional side effect from the deployed DB.
vi.mock("../src/modules/notifications/infrastructure/operation-notification.repository.js", () => ({
  operationNotificationRepository: { publishForActorAndAdmins: vi.fn().mockResolvedValue(undefined) },
}));
