import { AppError } from "../../../shared/errors/app-error.js";
import { violatesUniqueConstraint } from "../../../shared/database/unique-constraint.js";

export function createTrainingService({ repository, auditService }) {
  const ensureCoachAssignment = async (memberId, actor) => {
    if (actor.role === "coach" && !await repository.assigned(memberId, actor.id)) throw new AppError({ statusCode: 403, code: "COACH_MEMBER_NOT_ASSIGNED", message: "Coach chỉ được thao tác với hội viên đang được phân công." });
  };
  const ownMemberId = async (actor) => {
    const member = await repository.memberByUser(actor.id);
    if (!member) throw new AppError({ statusCode: 404, code: "MEMBER_PROFILE_NOT_FOUND", message: "Tài khoản chưa có hồ sơ hội viên." });
    return member.id;
  };
  const planForActor = async (planId, actor) => {
    const plan = await repository.plan(planId);
    if (!plan) throw new AppError({ statusCode: 404, code: "TRAINING_PLAN_NOT_FOUND", message: "Không tìm thấy giáo án." });
    await ensureCoachAssignment(plan.member_id, actor);
    return plan;
  };
  const sessionsWithExercises = async (planId) => Promise.all((await repository.sessions(planId)).map(async (item) => ({ ...item, exercises: await repository.sessionExercises(item.id) })));
  const ensureLegacyMutation = async (planId) => {
    if (repository.personalizationForPlan && await repository.personalizationForPlan(planId)) throw new AppError({ statusCode: 409, code: "TRAINING_PERSONALIZATION_WORKFLOW_REQUIRED", message: "Giáo án theo bằng chứng phải được xử lý qua quy trình duyệt cá nhân; không sửa bằng biểu mẫu giáo án cũ." });
  };
  const sameIds = (actual, requested) => actual.length === requested.length && actual.every((item) => requested.includes(item.id));
  const withCreatorMetadata = async (plans) => {
    if (!plans.length) return plans;
    const creators = await repository.usersByIds([...new Set(plans.map((plan) => plan.coach_user_id))]);
    const creatorById = new Map(creators.map((creator) => [creator.id, creator.display_name]));
    return plans.map((plan) => ({
      ...plan,
      ...(plan.created_at ? { createdAt: plan.created_at } : {}),
      ...(creatorById.has(plan.coach_user_id) ? { creatorName: creatorById.get(plan.coach_user_id) } : {}),
    }));
  };

  return {
    async templates() { const templates = await repository.templates(); return Promise.all(templates.map(async (template) => ({ ...template, exercises: await repository.templateExercises(template.id) }))); },
    async members(actor) { return actor.role === "coach" ? repository.membersForCoach(actor.id) : repository.members(); },
    async createTemplate(input, actorUserId) {
      const template = await repository.createTemplateWithExercises({ name: input.name, target_group: input.targetGroup, description: input.description ?? null, created_by: actorUserId }, input.exercises);
      await auditService.record({ actorUserId, action: "training_template.created", entityType: "training_template", entityId: template.id, summary: "Đã tạo mẫu giáo án." });
      return template;
    },
    async ownProgress(actor) {
      const memberId = await ownMemberId(actor);
      const [allPlans, allResults] = await Promise.all([repository.plans(memberId), repository.results(memberId)]);
      const plans = allPlans.filter((plan) => plan.status !== "draft");
      const visibleIds = new Set(plans.map((plan) => plan.id));
      const results = allResults.filter((result) => visibleIds.has(result.plan_id));
      const sessions = (await Promise.all(plans.map((plan) => sessionsWithExercises(plan.id)))).flat();
      return { plans, results, sessions };
    },
    async plans(memberId, actor) {
      if (memberId) { await ensureCoachAssignment(memberId, actor); return withCreatorMetadata(await repository.plans(memberId)); }
      if (actor.role === "coach") { const members = await repository.membersForCoach(actor.id); return withCreatorMetadata(await repository.plansForMembers(members.map((member) => member.id))); }
      return withCreatorMetadata(await repository.plans());
    },
    async createPlan(input, actor) {
      if (!await repository.member(input.memberId)) throw new AppError({ statusCode: 404, code: "MEMBER_NOT_FOUND", message: "Không tìm thấy hội viên." });
      await ensureCoachAssignment(input.memberId, actor);
      if (input.templateId && !await repository.template(input.templateId)) throw new AppError({ statusCode: 422, code: "TRAINING_TEMPLATE_NOT_FOUND", message: "Không tìm thấy mẫu giáo án." });
      const source = input.templateId ? await repository.templateExercises(input.templateId) : [];
      const exercises = input.exercises?.length ? input.exercises : source.map(({ name, sets, reps, duration_seconds, rest_seconds, instructions }) => ({ name, sets, reps, duration_seconds, rest_seconds, instructions }));
      const plan = await repository.createPlanWithExercises({ member_id: input.memberId, coach_user_id: actor.id, name: input.name, goal: input.goal, starts_on: new Date(input.startsOn), ends_on: new Date(input.endsOn), status: "active" }, exercises);
      await auditService.record({ actorUserId: actor.id, action: "training_plan.created", entityType: "training_plan", entityId: plan.id, summary: "Đã tạo giáo án cá nhân hóa." });
      return (await withCreatorMetadata([plan]))[0];
    },
    async sessions(planId, actor) { await planForActor(planId, actor); return sessionsWithExercises(planId); },
    async createSession(planId, input, actor) {
      await planForActor(planId, actor);
      await ensureLegacyMutation(planId);
      let result;
      try {
        result = await repository.createSession({ plan_id: planId, position: input.position, title: input.title, scheduled_on: input.scheduledOn ? new Date(input.scheduledOn) : null });
      } catch (error) {
        if (violatesUniqueConstraint(error, ["plan_id", "position"])) {
          throw new AppError({ statusCode: 409, code: "TRAINING_SESSION_POSITION_EXISTS", message: "Thứ tự buổi tập này đã có trong giáo án. Vui lòng chọn số thứ tự khác.", details: { field: "position" } });
        }
        throw error;
      }
      await repository.replaceSessionExercises(result.id, input.exercises);
      await auditService.record({ actorUserId: actor.id, action: "training_session.created", entityType: "training_session", entityId: result.id, summary: "Đã thêm buổi tập vào lộ trình." });
      return result;
    },
    async reorderSessions(planId, ids, actor) { await planForActor(planId, actor); await ensureLegacyMutation(planId); const existing = await repository.sessions(planId); if (!sameIds(existing, ids)) throw new AppError({ statusCode: 422, code: "TRAINING_SESSION_ORDER_INVALID", message: "Danh sách sắp xếp buổi tập không hợp lệ." }); return repository.reorderSessions(planId, ids); },
    async reorderSessionExercises(sessionId, ids, actor) { const session = await repository.session(sessionId); if (!session) throw new AppError({ statusCode: 404, code: "TRAINING_SESSION_NOT_FOUND", message: "Không tìm thấy buổi tập." }); await planForActor(session.plan_id, actor); await ensureLegacyMutation(session.plan_id); const existing = await repository.sessionExercises(sessionId); if (!sameIds(existing, ids)) throw new AppError({ statusCode: 422, code: "TRAINING_EXERCISE_ORDER_INVALID", message: "Danh sách sắp xếp bài tập không hợp lệ." }); return repository.reorderSessionExercises(sessionId, ids); },
    async updateSession(id, input, actor) {
      const existing = await repository.session(id);
      if (!existing) throw new AppError({ statusCode: 404, code: "TRAINING_SESSION_NOT_FOUND", message: "Không tìm thấy buổi tập." });
      await planForActor(existing.plan_id, actor);
      await ensureLegacyMutation(existing.plan_id);
      const result = await repository.updateSession(id, { status: input.status, completed_at: ["completed", "skipped"].includes(input.status) ? new Date() : null, coach_comment: input.coachComment ?? null });
      await auditService.record({ actorUserId: actor.id, action: "training_session.updated", entityType: "training_session", entityId: result.id, summary: "Đã cập nhật trạng thái buổi tập." });
      return result;
    },
    async updatePlan(id, input, actor) {
      const plan = await planForActor(id, actor);
      await ensureLegacyMutation(id);
      const result = await repository.updatePlan(id, { ...(input.name && { name: input.name }), ...(input.goal && { goal: input.goal }), ...(input.status && { status: input.status }) });
      if (input.exercises) await repository.replaceExercises(id, input.exercises);
      await auditService.record({ actorUserId: actor.id, action: "training_plan.updated", entityType: "training_plan", entityId: plan.id, summary: "Đã cập nhật giáo án." });
      return result;
    },
    async createResult(input, actor) {
      const plan = await planForActor(input.planId, actor);
      await ensureLegacyMutation(input.planId);
      const result = await repository.createResult({ plan_id: input.planId, exercise_id: input.exerciseId ?? null, member_id: plan.member_id, recorded_by: actor.id, recorded_on: new Date(input.recordedOn), value_numeric: input.valueNumeric ?? null, value_text: input.valueText ?? null, metric: input.metric, coach_comment: input.coachComment ?? null });
      await auditService.record({ actorUserId: actor.id, action: "training_result.recorded", entityType: "training_result", entityId: result.id, summary: "Đã ghi nhận kết quả tập luyện." });
      return result;
    },
    async results(memberId, actor) { await ensureCoachAssignment(memberId, actor); return repository.results(memberId); },
  };
}
