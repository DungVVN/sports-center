import { trainingFailure } from "../domain/personalization-policy.js";

export function createProfileOperations({ repository, now, missing, staffScope, ownMember, record, mutate }) {
  return {
    async reference(actor) {
      if (!["admin", "coach"].includes(actor.role))
        throw trainingFailure("FORBIDDEN", "Chỉ người phụ trách chuyên môn được xem không gian quản lý này.", 403);
      const [sources, metrics, protocols, authorizations, users] = await Promise.all([
        repository.sources(),
        repository.metrics(),
        repository.protocols(),
        repository.authorizations(actor.role === "admin" ? undefined : actor.id),
        actor.role === "admin" ? repository.usersForAuthorization() : Promise.resolve([]),
      ]);
      return {
        sources,
        metrics,
        protocols,
        authorizations,
        users,
        energyModelEnabled: false,
        consentPolicyVersion: "training-privacy-v1",
      };
    },
    async profile(memberId, actor) {
      await staffScope(memberId, actor);
      return repository.profile(memberId);
    },
    async mine(actor) {
      return repository.profile((await ownMember(actor)).id, { self: true });
    },
    async consent(input, actor) {
      const member = await ownMember(actor);
      const existing = await repository.activeConsent(member.id, input.purpose);
      if (existing) return existing;
      const result = await mutate(() =>
        repository.grantConsent({
          member_id: member.id,
          purpose: input.purpose,
          policy_version: input.policyVersion,
          recorded_by: actor.id,
          granted_at: now(),
        }),
      );
      await record("training.consent.granted", "training_consent", result.id, actor);
      return result;
    },
    async withdrawConsent(id, _input, actor) {
      const member = await ownMember(actor);
      const consent = await repository.consent(id);
      if (!consent || consent.member_id !== member.id) throw missing();
      if (consent.withdrawn_at) return consent;
      const result = await mutate(() => repository.withdrawConsent(id));
      await record("training.consent.withdrawn", "training_consent", id, actor);
      return result;
    },
  };
}
