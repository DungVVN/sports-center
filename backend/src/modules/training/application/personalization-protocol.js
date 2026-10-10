import { randomUUID } from "node:crypto";
import { trainingFailure, validatePrescription } from "../domain/personalization-policy.js";

export function createProtocolOperations({ repository, now, missing, authority, record, mutate, dateValue }) {
  return {
    async authorize(input, actor) {
      if (actor.role !== "admin")
        throw trainingFailure("FORBIDDEN", "Chỉ quản trị viên được ghi xác minh chứng chỉ chuyên môn.", 403);
      if (dateValue(input.expiresAt) <= now())
        throw trainingFailure("TRAINING_CREDENTIAL_EXPIRED", "Xác minh chuyên môn cần thời hạn còn hiệu lực.");
      const result = await mutate(() =>
        repository.createAuthorization({
          user_id: input.userId,
          discipline: input.discipline,
          credential_reference: input.credentialReference,
          verified_by: actor.id,
          verified_at: now(),
          expires_at: dateValue(input.expiresAt),
        }),
      );
      await record("training.credential.verified", "training_authorization", result.id, actor);
      return result;
    },
    async createProtocol(input, actor) {
      if (!["admin", "coach"].includes(actor.role))
        throw trainingFailure("FORBIDDEN", "Bạn không được soạn quy tắc chuyên môn.", 403);
      const sources = await repository.sources();
      if (input.evidence.some((item) => !sources.some((source) => source.id === item.sourceId)))
        throw trainingFailure("TRAINING_SOURCE_NOT_FOUND", "Nguồn bằng chứng chưa có trong danh mục được xác minh.");
      for (const rule of input.rules) {
        if (
          !input.evidence[rule.evidenceIndex] ||
          rule.conditions.some((condition) => !rule.requiredInputs.includes(condition.input))
        )
          throw trainingFailure(
            "TRAINING_RULE_EVIDENCE_INVALID",
            "Quy tắc phải viện dẫn đúng nguồn và đầu vào đã khai báo.",
          );
        for (const item of rule.recommendation.prescriptions) {
          validatePrescription(item, true);
          if (item.discipline !== input.discipline)
            throw trainingFailure(
              "TRAINING_PRESCRIPTION_DISCIPLINE_INVALID",
              "Nội dung bài tập phải cùng môn với quy tắc.",
            );
          for (const part of Object.values(item))
            if (part && typeof part === "object" && !Array.isArray(part) && !rule.requiredInputs.includes(part.input))
              throw trainingFailure(
                "TRAINING_RULE_BINDING_INVALID",
                "Liều tập liên kết cần có đầu vào thực tế được khai báo.",
              );
        }
      }
      const result = await mutate(() =>
        repository.createProtocol(
          {
            code: `PROTOCOL-${randomUUID()}`,
            version: 1,
            name: input.name,
            discipline: input.discipline,
            population_scope: input.populationScope,
            limitations: input.limitations,
            created_by: actor.id,
          },
          input.evidence.map((item) => ({
            source_id: item.sourceId,
            section_reference: item.sectionReference,
            interpretation: item.interpretation,
            applicability: item.applicability,
          })),
          input.rules.map((item) => ({
            code: item.code,
            evidenceIndex: item.evidenceIndex,
            required_inputs: item.requiredInputs,
            conditions: item.conditions,
            recommendation: item.recommendation,
            rationale: item.rationale,
          })),
        ),
      );
      await record("training.protocol.created", "training_protocol", result.id, actor);
      return result;
    },
    async approveProtocol(id, input, actor) {
      const protocol = await repository.protocol(id);
      if (!protocol) throw missing();
      await authority(input.authorizationId, actor, protocol.discipline);
      if (protocol.status !== "draft" || !protocol.rules.length || !protocol.evidence.length)
        throw trainingFailure("TRAINING_PROTOCOL_INCOMPLETE", "Quy tắc chưa đủ bằng chứng hoặc đã được duyệt.");
      const result = await mutate(() => repository.approveProtocol(id, input.authorizationId));
      await record("training.protocol.approved", "training_protocol", id, actor);
      return result;
    },
    async revokeAuthorization(id, _input, actor) {
      if (actor.role !== "admin")
        throw trainingFailure("FORBIDDEN", "Chỉ quản trị viên được thu hồi xác minh chuyên môn.", 403);
      const authorization = await repository.authorization(id);
      if (!authorization) throw missing();
      if (authorization.revoked_at) return authorization;
      const result = await mutate(() => repository.revokeAuthorization(id));
      await record("training.credential.revoked", "training_authorization", id, actor);
      return result;
    },
    async retireProtocol(id, _input, actor) {
      const protocol = await repository.protocol(id);
      if (!protocol) throw missing();
      if (actor.role !== "admin" && protocol.created_by !== actor.id)
        throw trainingFailure("FORBIDDEN", "Chỉ người soạn hoặc quản trị viên được ngừng áp dụng quy tắc.", 403);
      if (protocol.status === "retired") return protocol;
      const result = await mutate(() => repository.retireProtocol(id));
      await record("training.protocol.retired", "training_protocol", id, actor);
      return result;
    },
  };
}
