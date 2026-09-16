import { describe, expect, it, vi } from "vitest";
import { createAiAssistService } from "../src/modules/ai-assist/ai-assist.service.js";

describe("AI assist", () => {
  it("uses operational context but exposes labelled drafts only to Coaches", async () => {
    const repository = { coachClasses: vi.fn().mockResolvedValue([]), stalePlans: vi.fn().mockResolvedValue([{ id: "plan-1", name: "Sức bền" }]), upcomingBookings: vi.fn().mockResolvedValue([{ id: "class-1", name: "Yoga", booking_count: 3 }]), attendancePending: vi.fn().mockResolvedValue([{ id: "class-2", name: "Pilates" }]), expiringMembers: vi.fn().mockResolvedValue([{ member_name: "An", expires_on: new Date("2026-09-20") }]) };
    const auditService = { record: vi.fn() };
    const drafts = await createAiAssistService({ repository, auditService }).suggestions({ id: "coach-1", role: "coach" });
    expect(drafts[0]).toEqual(expect.objectContaining({ label: expect.stringContaining("Coach duyệt") }));
    expect(drafts[0].suggestions.map((item) => item.subject).join(" ")).toContain("Yoga");
    expect(drafts[0].suggestions.map((item) => item.subject).join(" ")).toContain("Pilates");
    expect(drafts[0].suggestions.map((item) => item.subject).join(" ")).toContain("Sức bền");
    expect(drafts[0].suggestions.map((item) => item.subject).join(" ")).toContain("An");
    await expect(createAiAssistService({ repository, auditService }).suggestions({ id: "member-1", role: "member" })).rejects.toMatchObject({ code: "AI_ASSIST_COACH_ONLY" });
  });

  it("requires Coach scope and records a reviewed delivery before notifying the Member", async () => {
    const repository = { memberForCoach: vi.fn().mockResolvedValue({ id: "member-1", user_id: "member-user", full_name: "An" }), createDelivery: vi.fn().mockResolvedValue({ id: "delivery-1" }) };
    const auditService = { record: vi.fn() };
    await expect(createAiAssistService({ repository, auditService }).deliver({ memberId: "member-1", subject: "Nhắc lịch", body: "Coach đã rà soát nội dung này." }, { id: "coach-1", role: "coach" })).resolves.toEqual({ id: "delivery-1" });
    expect(repository.createDelivery).toHaveBeenCalledWith(expect.objectContaining({ coachUserId: "coach-1", memberUserId: "member-user" }));
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "ai_suggestion.delivered" }));
  });
});
