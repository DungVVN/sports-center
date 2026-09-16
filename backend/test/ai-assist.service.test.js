import { describe, expect, it, vi } from "vitest";
import { createAiAssistService } from "../src/modules/ai-assist/ai-assist.service.js";

describe("AI assist", () => {
  it("uses operational context but exposes labelled drafts only to Coaches", async () => {
    const repository = { coachClasses: vi.fn().mockResolvedValue([]), stalePlans: vi.fn().mockResolvedValue([{ id: "plan-1", name: "Sức bền" }]), upcomingBookings: vi.fn().mockResolvedValue([{ id: "class-1", name: "Yoga", booking_count: 3 }]), attendancePending: vi.fn().mockResolvedValue([{ id: "class-2", name: "Pilates" }]), expiringMembers: vi.fn().mockResolvedValue([{ member_name: "An", expires_on: new Date("2026-09-20") }]) };
    const drafts = await createAiAssistService({ repository }).suggestions({ id: "coach-1", role: "coach" });
    expect(drafts[0]).toEqual(expect.objectContaining({ label: expect.stringContaining("Coach duyệt") }));
    expect(drafts[0].suggestions.map((item) => item.subject).join(" ")).toContain("Yoga");
    expect(drafts[0].suggestions.map((item) => item.subject).join(" ")).toContain("Pilates");
    expect(drafts[0].suggestions.map((item) => item.subject).join(" ")).toContain("Sức bền");
    expect(drafts[0].suggestions.map((item) => item.subject).join(" ")).toContain("An");
    await expect(createAiAssistService({ repository }).suggestions({ id: "member-1", role: "member" })).rejects.toMatchObject({ code: "AI_ASSIST_COACH_ONLY" });
  });
});
