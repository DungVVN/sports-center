import { checkProfessionalAuthorization, trainingFailure } from "../domain/personalization-policy.js";

export function createPersonalizationContext({ repository, directory, auditService, now = () => new Date() }) {
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
  return { repository, directory, now, missing, staffScope, ownMember, authority, record, currentPlanReview, mutate, dateValue, localDay };
}
