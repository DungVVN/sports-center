import { checkMetric, trainingFailure } from "../domain/personalization-policy.js";

export function createSessionOperations({ repository, now, missing, staffScope, ownMember, record, currentPlanReview, mutate, dateValue, localDay }) {
  return {
    async checkin(id, input, actor) {
      const member = await ownMember(actor);
      const session = await repository.session(id);
      if (!session || session.plan?.member_id !== member.id || session.plan.status !== "active") throw missing();
      await currentPlanReview(session.plan.id);
      if (input.sessionDate > localDay())
        throw trainingFailure("TRAINING_CHECKIN_FUTURE", "Không check-in buổi tập trong tương lai.");
      return mutate(() =>
        repository.createCheckin({
          member_id: member.id,
          training_session_id: id,
          session_date: dateValue(input.sessionDate),
          available_minutes: input.availableMinutes,
          sleep_hours: input.sleepHours ?? null,
          fatigue_score: input.fatigueScore ?? null,
          discomfort_score: input.discomfortScore ?? null,
          new_symptoms: input.newSymptoms,
          notes: input.notes,
          other_activity: input.otherActivity,
        }),
      );
    },
    async reviewCheckin(id, input, actor) {
      const checkin = await repository.checkin(id);
      if (!checkin) throw missing();
      await staffScope(checkin.member_id, actor);
      if (checkin.new_symptoms && input.status !== "hold")
        throw trainingFailure(
          "TRAINING_SYMPTOMS_REQUIRE_FOLLOW_UP",
          "Triệu chứng mới cần tạm dừng và xử lý chuyên môn.",
        );
      const result = await mutate(() =>
        repository.reviewCheckin(id, { review_status: input.status, reviewed_by: actor.id, reviewed_at: now() }),
      );
      await record("training.checkin.reviewed", "training_checkin", id, actor);
      return result;
    },
    async observe(id, input, actor) {
      const session = await repository.session(id);
      if (!session) throw missing();
      await staffScope(session.plan.member_id, actor);
      const metrics = await repository.metrics();
      const discipline = await repository.disciplineForPlan(session.plan.id);
      if (!discipline || session.plan.status !== "active")
        throw trainingFailure(
          "TRAINING_ACTIVE_DECISION_REQUIRED",
          "Cần giáo án cá nhân đã duyệt để ghi kết quả theo quy trình mới.",
        );
      checkMetric(
        metrics.find((item) => item.code === input.metricCode),
        input,
        discipline,
      );
      if (dateValue(input.recordedAt) > now())
        throw trainingFailure("TRAINING_OBSERVATION_FUTURE", "Không ghi kết quả thực tế trong tương lai.");
      const result = await mutate(() =>
        repository.createObservation({
          member_id: session.plan.member_id,
          training_session_id: id,
          metric_code: input.metricCode,
          unit: input.unit,
          value_numeric: input.valueNumeric ?? null,
          value_text: input.valueText ?? null,
          data_kind: input.dataKind,
          method: input.method,
          recorded_by: actor.id,
          recorded_at: dateValue(input.recordedAt),
        }),
      );
      await record("training.observation.recorded", "training_observation", result.id, actor);
      return result;
    },
    async energy(input, actor) {
      const member = await ownMember(actor);
      const consent = await repository.activeConsent(member.id, "nutrition_tracking");
      if (!consent)
        throw trainingFailure(
          "TRAINING_NUTRITION_CONSENT_REQUIRED",
          "Cần đồng ý riêng trước khi ghi nhật ký năng lượng.",
        );
      if (input.recordedOn > localDay())
        throw trainingFailure("TRAINING_ENERGY_FUTURE", "Không ghi nhật ký năng lượng trong tương lai.");
      if (input.energyType !== "total_daily" && input.includesExercise)
        throw trainingFailure("TRAINING_ENERGY_SCOPE_INVALID", "Chỉ tổng tiêu hao ngày mới có cờ đã bao gồm vận động.");
      return mutate(() =>
        repository.createEnergy({
          member_id: member.id,
          consent_id: consent.id,
          recorded_on: dateValue(input.recordedOn),
          energy_type: input.energyType,
          value_kcal: input.valueKcal,
          data_kind: input.dataKind,
          method: input.method,
          includes_exercise: input.includesExercise,
          inputs: {},
          recorded_by: actor.id,
        }),
      );
    },
    async sessionOutcome(id, input, actor) {
      const session = await repository.session(id);
      if (!session) throw missing();
      await staffScope(session.plan.member_id, actor);
      if (
        !(await repository.disciplineForPlan(session.plan.id)) ||
        session.plan.status !== "active" ||
        session.status !== "pending"
      )
        throw trainingFailure(
          "TRAINING_SESSION_STATE_INVALID",
          "Chỉ ghi kết quả cho buổi đang chờ trong giáo án đã duyệt.",
          409,
        );
      const checkin = await repository.latestCheckin(id);
      if (input.status === "completed") await currentPlanReview(session.plan.id);
      if (input.status === "completed" && (!checkin || checkin.review_status !== "reviewed" || checkin.new_symptoms))
        throw trainingFailure(
          "TRAINING_CHECKIN_REVIEW_REQUIRED",
          "Cần HLV review thể trạng trước khi xác nhận buổi tập hoàn thành.",
        );
      const result = await mutate(() =>
        repository.sessionOutcome(id, { status: input.status, coach_comment: input.coachComment, completed_at: now() }),
      );
      await record("training.session.outcome", "training_session", id, actor);
      return result;
    },
  };
}
