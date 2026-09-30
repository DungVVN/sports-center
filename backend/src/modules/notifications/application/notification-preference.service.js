export function createNotificationPreferenceService({ repository }) {
  return {
    async get(actor) {
      return (await repository.get(actor.id)) ?? { user_id: actor.id, email_enabled: true, push_enabled: false };
    },
    async save(input, actor) {
      return repository.save(actor.id, { email_enabled: input.emailEnabled, push_enabled: false });
    },
  };
}
