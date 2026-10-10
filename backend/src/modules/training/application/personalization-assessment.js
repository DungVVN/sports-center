import { checkMetric, checkPopulation, trainingFailure } from "../domain/personalization-policy.js";

export function createAssessmentOperations({ repository, directory, now, missing, staffScope, authority, record, mutate, dateValue }) {
  return {
    async createAssessment(memberId, input, actor) {
      await staffScope(memberId, actor);
      const consent = await repository.activeConsent(memberId, "assessment");
      if (!consent)
        throw trainingFailure(
          "TRAINING_CONSENT_REQUIRED",
          "Hội viên cần xác nhận đồng ý đánh giá trước khi lưu hồ sơ.",
        );
      if (
        dateValue(input.assessedAt) > now() ||
        dateValue(input.reviewDueAt) <= now() ||
        dateValue(input.reviewDueAt) <= dateValue(input.assessedAt)
      )
        throw trainingFailure("TRAINING_ASSESSMENT_DATES_INVALID", "Thời điểm đánh giá và hạn review không hợp lệ.");
      if (new Set(input.availableDays).size !== input.availableDays.length)
        throw trainingFailure("TRAINING_DAYS_DUPLICATED", "Không lặp ngày có thể tập.");
      const metrics = await repository.metrics();
      for (const measurement of input.measurements) {
        checkMetric(
          metrics.find((item) => item.code === measurement.metricCode),
          measurement,
          input.discipline,
        );
        if (dateValue(measurement.measuredAt) > now())
          throw trainingFailure("TRAINING_MEASUREMENT_FUTURE", "Không ghi số đo trong tương lai.");
      }
      const member = await directory.member(memberId);
      for (const goal of input.goals ?? []) {
        const baseline = input.measurements[goal.baselineMeasurementIndex];
        if (
          !baseline ||
          baseline.dataKind === "estimated" ||
          baseline.metricCode !== goal.metricCode ||
          baseline.unit !== goal.unit ||
          dateValue(goal.dueOn) <= dateValue(input.assessedAt)
        )
          throw trainingFailure(
            "TRAINING_GOAL_BASELINE_INVALID",
            "Chỉ tiêu cần số đo gốc thực tế, đúng chỉ số/đơn vị và ngày đánh giá sau số đo gốc.",
          );
        checkMetric(
          metrics.find((item) => item.code === goal.metricCode),
          { unit: goal.unit, valueNumeric: goal.targetNumeric, valueText: goal.targetText, dataKind: "observed" },
          input.discipline,
        );
      }
      if (input.population && member.date_of_birth) {
        const birth = new Date(member.date_of_birth);
        const at = dateValue(input.assessedAt);
        let age = at.getUTCFullYear() - birth.getUTCFullYear();
        if (
          at.getUTCMonth() < birth.getUTCMonth() ||
          (at.getUTCMonth() === birth.getUTCMonth() && at.getUTCDate() < birth.getUTCDate())
        )
          age--;
        if (input.population.age_years !== age)
          throw trainingFailure("TRAINING_AGE_MISMATCH", "Tuổi đánh giá không khớp ngày sinh đã lưu.");
      }
      const result = await mutate(() =>
        repository.createAssessment(
          {
            member_id: memberId,
            consent_id: consent.id,
            version: undefined,
            discipline: input.discipline,
            goal: input.goal,
            available_days: input.availableDays,
            minutes_per_session: input.minutesPerSession,
            experience: input.experience,
            equipment: input.equipment,
            other_activity: input.otherActivity,
            population: input.population ?? {},
            screening_status: input.screeningStatus,
            screening_tool: input.screeningTool ?? null,
            screening_version: input.screeningVersion ?? null,
            assessed_by: actor.id,
            assessed_at: dateValue(input.assessedAt),
            review_due_at: dateValue(input.reviewDueAt),
          },
          input.measurements.map((item) => ({
            metric_code: item.metricCode,
            unit: item.unit,
            value_numeric: item.valueNumeric ?? null,
            value_text: item.valueText ?? null,
            data_kind: item.dataKind,
            method: item.method,
            device: item.device ?? null,
            conditions: item.conditions,
            recorded_by: actor.id,
            measured_at: dateValue(item.measuredAt),
          })),
          input.findings.map((item) => ({ ...item, recorded_by: actor.id })),
          (input.goals ?? []).map((item) => ({
            metric_code: item.metricCode,
            unit: item.unit,
            baselineIndex: item.baselineMeasurementIndex,
            target_numeric: item.targetNumeric ?? null,
            target_text: item.targetText ?? null,
            evaluation_method: item.evaluationMethod,
            due_on: dateValue(item.dueOn),
            set_by: actor.id,
          })),
        ),
      );
      await record("training.assessment.created", "training_assessment", result.id, actor);
      return result;
    },
    async reviewAssessment(id, input, actor) {
      const assessment = await repository.assessment(id);
      if (!assessment) throw missing();
      await staffScope(assessment.member_id, actor);
      await authority(input.authorizationId, actor, assessment.discipline);
      if (
        assessment.status !== "draft" ||
        assessment.screening_status !== "reviewed_for_scope" ||
        !assessment.screening_tool ||
        !assessment.screening_version ||
        !assessment.findings.some((item) => item.category === "movement")
      )
        throw trainingFailure(
          "TRAINING_ASSESSMENT_INCOMPLETE",
          "Cần hoàn tất sàng lọc và ghi đánh giá vận động trước khi duyệt.",
        );
      checkPopulation(assessment, {
        population_scope: {
          minimum_age_years: 0,
          pregnancy_allowed: true,
          breastfeeding_allowed: true,
          clinical_restrictions_allowed: true,
        },
      });
      const result = await mutate(() => repository.reviewAssessment(id, input.authorizationId));
      await record("training.assessment.reviewed", "training_assessment", id, actor);
      return result;
    },
  };
}
