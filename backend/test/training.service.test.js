import { describe, expect, it, vi } from "vitest";
import { createTrainingService } from "../src/modules/training/training.service.js";

function dependencies() {
  return {
    repository: { membersForCoach: vi.fn().mockResolvedValue([{ id: "member-1" }]), plansForMembers: vi.fn().mockResolvedValue([{ id: "plan-1" }]), plans: vi.fn().mockResolvedValue([{ id: "manager-plan" }]), member: vi.fn(), assigned: vi.fn(), template: vi.fn(), templateExercises: vi.fn(), createPlan: vi.fn(), replaceExercises: vi.fn() },
    auditService: { record: vi.fn() },
  };
}

describe("Training service scope", () => {
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
});
