import { checkPopulation, evaluateRecordedRules, recordedInputs, trainingFailure } from "../domain/personalization-policy.js";

export function createDecisionOperations({ repository, now, missing, staffScope, authority, record, mutate, dateValue, localDay }) {
  return {
    async createDecision(input, actor) {
      const assessment = await repository.assessment(input.assessmentId);
      if (!assessment) throw missing();
      await staffScope(assessment.member_id, actor);
      const existing = await repository.decisionByKey(input.idempotencyKey);
      if (existing) {
        if (
          existing.assessment_id !== input.assessmentId ||
          existing.protocol_id !== input.protocolId ||
          existing.member_id !== assessment.member_id ||
          JSON.stringify(existing.inputs_snapshot.session_dates) !== JSON.stringify(input.sessionDates)
        )
          throw trainingFailure(
            "TRAINING_IDEMPOTENCY_CONFLICT",
            "Mã yêu cầu đã được dùng cho một hồ sơ hoặc lịch khác.",
            409,
          );
        return repository.decision(existing.id);
      }
      const protocol = await repository.protocol(input.protocolId);
      if (
        !protocol ||
        protocol.status !== "approved" ||
        assessment.status !== "reviewed" ||
        assessment.screening_status !== "reviewed_for_scope" ||
        new Date(assessment.review_due_at) <= now()
      )
        throw trainingFailure(
          "TRAINING_REVIEW_REQUIRED",
          "Cần đánh giá còn hiệu lực và quy tắc đã duyệt trước khi tạo giáo án.",
        );
      if (protocol.discipline !== assessment.discipline || protocol.discipline === "nutrition")
        throw trainingFailure("TRAINING_DISCIPLINE_MISMATCH", "Quy tắc không phù hợp môn tập.");
      if (!(await repository.activeConsent(assessment.member_id, "assessment")))
        throw trainingFailure("TRAINING_CONSENT_REQUIRED", "Hội viên đã rút đồng ý đánh giá.");
      if (dateValue(input.endsOn) < dateValue(input.startsOn))
        throw trainingFailure("TRAINING_PLAN_DATES_INVALID", "Ngày kết thúc phải từ ngày bắt đầu trở đi.");
      if (
        input.startsOn < localDay() ||
        dateValue(input.endsOn) > dateValue(assessment.review_due_at) ||
        new Set(input.sessionDates).size !== input.sessionDates.length ||
        input.sessionDates.some(
          (day) =>
            day < input.startsOn ||
            day > input.endsOn ||
            !assessment.available_days.includes(dateValue(day).getUTCDay()),
        )
      )
        throw trainingFailure(
          "TRAINING_SCHEDULE_INVALID",
          "Lịch phải nằm trong thời hạn đánh giá, không lặp ngày và đúng ngày hội viên có thể tập.",
        );
      checkPopulation(assessment, protocol);
      const inputs = recordedInputs(assessment, assessment.measurements, assessment.findings);
      const { matched, prescriptions } = evaluateRecordedRules(protocol.rules, inputs);
      const required = new Set(matched.flatMap((rule) => rule.required_inputs));
      const result = await mutate(() =>
        repository.createDecision(
          {
            member_id: assessment.member_id,
            assessment_id: assessment.id,
            protocol_id: protocol.id,
            idempotency_key: input.idempotencyKey,
            revision: 1,
            origin: "rules",
            inputs_snapshot: {
              assessment_id: assessment.id,
              assessment_version: assessment.version,
              protocol_version: protocol.version,
              session_dates: input.sessionDates,
              evaluator: "recorded-facts-v1",
            },
            explanation: matched.map((rule) => rule.rationale).join("\n"),
            created_by: actor.id,
          },
          [...inputs.values()].filter((item) => required.has(item.input_key)),
          matched,
          prescriptions,
          {
            name: protocol.name,
            goal: assessment.goal,
            startsOn: dateValue(input.startsOn),
            endsOn: dateValue(input.endsOn),
            sessionDates: input.sessionDates.map(dateValue),
          },
        ),
      );
      await record("training.decision.drafted", "training_decision", result.id, actor);
      return repository.decision(result.id);
    },
    async approveDecision(id, input, actor) {
      const decision = await repository.decision(id);
      if (!decision) throw missing();
      await staffScope(decision.member_id, actor);
      await authority(input.authorizationId, actor, decision.protocol.discipline);
      if (decision.status !== "draft")
        throw trainingFailure("TRAINING_DECISION_ALREADY_FINAL", "Giáo án này đã có quyết định duyệt.", 409);
      const result = await mutate(() => repository.approveDecision(id, decision.plan_id, input.authorizationId));
      await record("training.decision.approved", "training_decision", id, actor);
      return result;
    },
  };
}
