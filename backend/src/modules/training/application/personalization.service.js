import { randomUUID } from "node:crypto";
import {
  checkMetric,
  checkPopulation,
  checkProfessionalAuthorization,
  evaluateRecordedRules,
  recordedInputs,
  trainingFailure,
  validatePrescription,
} from "../domain/personalization-policy.js";

export function createPersonalizationService({ repository, directory, auditService, now = () => new Date() }) {
  const missing = () =>
    trainingFailure("TRAINING_RECORD_NOT_FOUND", "Không tìm thấy dữ liệu tập luyện trong phạm vi của bạn.", 404);
  async function staffScope(memberId, actor) {
    if (actor.role !== "admin" && (actor.role !== "coach" || !(await directory.assigned(memberId, actor.id))))
      throw trainingFailure(
        "TRAINING_MEMBER_OUTSIDE_SCOPE",
        "Bạn không được truy cập hồ sơ đánh giá của hội viên này.",
        403,
      );
    if (!(await directory.member(memberId))) throw missing();
  }
  async function ownMember(actor) {
    const member = await directory.memberByUser(actor.id);
    if (!member) throw trainingFailure("MEMBER_PROFILE_NOT_FOUND", "Tài khoản chưa có hồ sơ hội viên.", 404);
    return member;
  }
  async function authority(id, actor, discipline) {
    const authorization = await repository.authorization(id);
    checkProfessionalAuthorization(authorization, actor, discipline, now());
    return authorization;
  }
  async function record(action, entityType, entityId, actor) {
    await auditService.record({
      actorUserId: actor.id,
      action,
      entityType,
      entityId,
      summary: "Đã cập nhật dữ liệu tập luyện theo quyền và phạm vi chuyên môn.",
    });
  }
  async function currentPlanReview(planId) {
    const decision = await repository.approvedDecisionForPlan(planId);
    if (!decision)
      throw trainingFailure("TRAINING_ACTIVE_DECISION_REQUIRED", "Cần giáo án đã duyệt để tiếp tục buổi tập.");
    const assessment = await repository.assessment(decision.assessment_id);
    const protocol = await repository.protocol(decision.protocol_id);
    if (
      protocol.status !== "approved" ||
      new Date(assessment.review_due_at) <= now() ||
      !(await repository.activeConsent(decision.member_id, "assessment"))
    )
      throw trainingFailure("TRAINING_PLAN_REVIEW_EXPIRED", "Giáo án cần review lại hoặc hội viên đã rút đồng ý.");
    for (const id of [
      decision.review_authorization_id,
      assessment.review_authorization_id,
      protocol.review_authorization_id,
    ]) {
      const credential = await repository.authorization(id);
      checkProfessionalAuthorization(credential, { id: credential?.user_id }, protocol.discipline, now());
    }
  }
  async function mutate(task) {
    try {
      return await task();
    } catch (error) {
      if (error.code === "P2002")
        throw trainingFailure(
          "TRAINING_CONFLICT",
          "Dữ liệu đã tồn tại hoặc vừa được người khác thay đổi. Hãy tải lại.",
          409,
        );
      if (error.code === "P2025") throw missing();
      if (error.code === "P2004" || error.meta?.driverAdapterError?.cause?.originalCode === "23514")
        throw trainingFailure(
          "TRAINING_DATABASE_POLICY",
          "Dữ liệu chưa đáp ứng ràng buộc bằng chứng, phạm vi hoặc duyệt chuyên môn.",
        );
      throw error;
    }
  }
  const dateValue = (value) => new Date(value);
  const localDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now());
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
