import { describe, expect, it, vi } from "vitest";
import { createNotificationPreferenceService } from "../src/modules/notifications/index.js";

describe("notification preferences", () => {
  const actor = { id: "user-1" };

  it("returns existing values or the unchanged defaults for the current user", async () => {
    const repository = { get: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ user_id: actor.id, email_enabled: false, push_enabled: false }) };
    const service = createNotificationPreferenceService({ repository });
    await expect(service.get(actor)).resolves.toEqual({ user_id: actor.id, email_enabled: true, push_enabled: false });
    await expect(service.get(actor)).resolves.toEqual({ user_id: actor.id, email_enabled: false, push_enabled: false });
    expect(repository.get).toHaveBeenCalledWith(actor.id);
  });

  it("writes only the actor's email choice and leaves push disabled", async () => {
    const repository = { save: vi.fn().mockResolvedValue({ user_id: actor.id, email_enabled: false, push_enabled: false }) };
    const service = createNotificationPreferenceService({ repository });
    await expect(service.save({ emailEnabled: false, pushEnabled: true }, actor)).resolves.toMatchObject({ email_enabled: false });
    expect(repository.save).toHaveBeenCalledExactlyOnceWith(actor.id, { email_enabled: false, push_enabled: false });
  });
});
