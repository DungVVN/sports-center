import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { personalizationApi } from "../api/personalization-api.js";
import { MemberPersonalization } from "./MemberPersonalization.jsx";
vi.mock("../api/personalization-api.js", () => ({ personalizationApi: { mine: vi.fn(), consent: vi.fn(), withdraw: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const empty = { assessments: [], decisions: [], consents: [], checkins: [], observations: [], energy: [] };
function renderProfile() { const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); return render(<QueryClientProvider client={client}><MemberPersonalization /></QueryClientProvider>); }
describe("member training privacy and safe empty state", () => {
  it("requires a deliberate acknowledgment before granting assessment consent", async () => {
    personalizationApi.mine.mockResolvedValue(empty);
    personalizationApi.consent.mockResolvedValue({ id: "consent" });
    renderProfile();
    const button = await screen.findByRole("button", { name: "Đồng ý đánh giá" });
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(personalizationApi.consent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Tôi đã đọc/ }));
    fireEvent.click(button);
    await waitFor(() => expect(personalizationApi.consent).toHaveBeenCalledWith("assessment"));
    expect(screen.getByText("Chưa có giáo án cá nhân được duyệt.")).toBeTruthy();
  });
  it("allows withdrawal of only the current consent and keeps calorie estimates explicitly unavailable", async () => {
    personalizationApi.mine.mockResolvedValue({ ...empty, consents: [{ id: "current", purpose: "assessment", withdrawn_at: null }] });
    personalizationApi.withdraw.mockResolvedValue({ id: "current" });
    renderProfile();
    fireEvent.click(await screen.findByRole("button", { name: "Rút đồng ý đánh giá" }));
    await waitFor(() => expect(personalizationApi.withdraw).toHaveBeenCalledWith("current"));
    expect(screen.getByText(/Hệ thống chưa tính BMR\/TDEE/)).toBeTruthy();
  });
});
