import { describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock("../src/database.js", () => ({ prisma }));
import { trainingRepository } from "../src/modules/training/training.repository.js";

describe("training repository atomic creation", () => {
  it("does not report a created plan if its exercises fail in the same transaction", async () => {
    const tx = {
      training_plans: { create: vi.fn().mockResolvedValue({ id: "plan-1" }) },
      training_plan_exercises: { createMany: vi.fn().mockRejectedValue(new Error("exercise insert failed")) },
    };
    prisma.$transaction.mockImplementation((action) => action(tx));
    await expect(trainingRepository.createPlanWithExercises({ member_id: "member-1" }, [{ name: "Chạy" }])).rejects.toThrow("exercise insert failed");
    expect(tx.training_plan_exercises.createMany).toHaveBeenCalledWith({ data: [{ plan_id: "plan-1", position: 1, name: "Chạy" }] });
  });
});
