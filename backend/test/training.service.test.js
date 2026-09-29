import { describe, expect, it, vi } from "vitest";
import { createTrainingService } from "../src/modules/training/index.js";

function dependencies() {
  return {
    repository: { membersForCoach: vi.fn().mockResolvedValue([{ id: "member-1" }]), plansForMembers: vi.fn().mockResolvedValue([{ id: "plan-1" }]), plans: vi.fn().mockResolvedValue([{ id: "manager-plan" }]), usersByIds: vi.fn().mockResolvedValue([]), member: vi.fn(), assigned: vi.fn().mockResolvedValue(true), template: vi.fn(), templateExercises: vi.fn(), createTemplateWithExercises: vi.fn().mockResolvedValue({ id: "template-1" }), createPlanWithExercises: vi.fn().mockResolvedValue({ id: "plan-1" }), replaceExercises: vi.fn(), plan: vi.fn().mockResolvedValue({ id: "plan-1", member_id: "member-1" }), session: vi.fn(), createSession: vi.fn().mockResolvedValue({ id: "session-1" }), updateSession: vi.fn().mockResolvedValue({ id: "session-1" }), sessions: vi.fn().mockResolvedValue([{ id: "session-1" }, { id: "session-2" }]), sessionExercises: vi.fn().mockResolvedValue([]), reorderSessions: vi.fn().mockResolvedValue([]) },
    auditService: { record: vi.fn() },
  };
}

describe("Training service scope", () => {
  it("creates a template and its exercises together", async () => {
    const { repository, auditService } = dependencies();
    const exercises = [{ name: "Chạy", sets: 3, reps: 1 }];
    await createTrainingService({ repository, auditService }).createTemplate({ name: "Sức bền", targetGroup: "Người mới", exercises }, "coach-1");
    expect(repository.createTemplateWithExercises).toHaveBeenCalledWith(expect.objectContaining({ name: "Sức bền" }), exercises);
  });

  it("creates a plan and its exercises in one repository transaction", async () => {
    const { repository, auditService } = dependencies();
    repository.member.mockResolvedValue({ id: "member-1" });
    const input = { memberId: "member-1", name: "Kế hoạch", goal: "Sức bền", startsOn: "2026-10-01", endsOn: "2026-10-31", exercises: [{ name: "Chạy", sets: 3, reps: 1 }] };
    await createTrainingService({ repository, auditService }).createPlan(input, { id: "coach-1", role: "coach" });
    expect(repository.createPlanWithExercises).toHaveBeenCalledWith(expect.objectContaining({ member_id: "member-1" }), input.exercises);
    expect(repository.replaceExercises).not.toHaveBeenCalled();
  });

  it("returns a fixable conflict for duplicate session positions", async () => {
    const { repository, auditService } = dependencies();
    repository.createSession.mockRejectedValue({ code: "P2002", meta: { target: ["plan_id", "position"] } });
    await expect(createTrainingService({ repository, auditService }).createSession("plan-1", { position: 1, title: "Buổi 1", exercises: [] }, { id: "coach-1", role: "coach" }))
      .rejects.toMatchObject({ statusCode: 409, code: "TRAINING_SESSION_POSITION_EXISTS" });
  });

  it("uses the Coach's booking and assignment scope for the member picker", async () => {
    const { repository, auditService } = dependencies();
    repository.membersForCoach.mockResolvedValue([{ id: "member-from-class" }]);

    await expect(createTrainingService({ repository, auditService }).members({ id: "coach-1", role: "coach" })).resolves.toEqual([{ id: "member-from-class" }]);
    expect(repository.membersForCoach).toHaveBeenCalledWith("coach-1");
  });

  it("limits unfiltered Coach plans to current assignments", async () => {
    const { repository, auditService } = dependencies();
    await expect(createTrainingService({ repository, auditService }).plans(undefined, { id: "coach-1", role: "coach" })).resolves.toEqual([{ id: "plan-1" }]);
    expect(repository.plansForMembers).toHaveBeenCalledWith(["member-1"]);
    expect(repository.plans).not.toHaveBeenCalled();
  });

  it("returns all plans only to non-Coach roles", async () => {
    const { repository, auditService } = dependencies();
    await createTrainingService({ repository, auditService }).plans(undefined, { id: "manager-1", role: "manager" });
    expect(repository.plans).toHaveBeenCalledWith();
  });

  it("adds the creator name and database creation time to plans", async () => {
    const { repository, auditService } = dependencies();
    const createdAt = new Date("2026-09-24T08:30:00.000Z");
    repository.plans.mockResolvedValue([{ id: "plan-1", coach_user_id: "coach-1", created_at: createdAt }]);
    repository.usersByIds.mockResolvedValue([{ id: "coach-1", display_name: "Coach An" }]);

    await expect(createTrainingService({ repository, auditService }).plans(undefined, { id: "manager-1", role: "manager" })).resolves.toEqual([
      expect.objectContaining({ creatorName: "Coach An", createdAt }),
    ]);
  });

  it("records a completed session only after confirming the Coach scope", async () => {
    const { repository, auditService } = dependencies();
    repository.session.mockResolvedValue({ id: "session-1", plan_id: "plan-1" });
    const result = await createTrainingService({ repository, auditService }).updateSession("session-1", { status: "completed", coachComment: "Đã hoàn thành tốt" }, { id: "coach-1", role: "coach" });
    expect(repository.assigned).toHaveBeenCalledWith("member-1", "coach-1");
    expect(repository.updateSession).toHaveBeenCalledWith("session-1", expect.objectContaining({ status: "completed", coach_comment: "Đã hoàn thành tốt", completed_at: expect.any(Date) }));
    expect(result).toEqual({ id: "session-1" });
  });

  it("only accepts a complete session ordering for an assigned Coach", async () => {
    const { repository, auditService } = dependencies();
    await createTrainingService({ repository, auditService }).reorderSessions("plan-1", ["session-2", "session-1"], { id: "coach-1", role: "coach" });
    expect(repository.reorderSessions).toHaveBeenCalledWith("plan-1", ["session-2", "session-1"]);
  });
});
