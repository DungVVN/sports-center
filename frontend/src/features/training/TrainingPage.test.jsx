import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/api-error.js";
import { trainingApi } from "./training-api.js";
import { TrainingPage } from "./TrainingPage.jsx";

vi.mock("./training-api.js", () => ({ trainingApi: { templates: vi.fn(), members: vi.fn(), plans: vi.fn(), aiSuggestions: vi.fn(), sessions: vi.fn(), createTemplate: vi.fn(), createPlan: vi.fn(), updatePlan: vi.fn(), createSession: vi.fn(), reorderSessions: vi.fn(), reorderSessionExercises: vi.fn(), updateSession: vi.fn(), deliverAiSuggestion: vi.fn(), recordResult: vi.fn() } }));

const coachSession = { user: { role: "coach", displayName: "Coach An" }, permissions: [] };
const activePlan = { id: "plan-1", name: "Tăng sức bền", member_id: "member-1", status: "active", createdAt: new Date().toISOString() };
let activeClient;

function renderPage(session = coachSession) {
  activeClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={activeClient}><TrainingPage session={session} /></QueryClientProvider>);
}

describe("TrainingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trainingApi.templates.mockImplementation(() => Promise.resolve([]));
    trainingApi.members.mockImplementation(() => Promise.resolve([{ id: "member-1", full_name: "Bình", member_code: "HV-01" }]));
    trainingApi.plans.mockImplementation(() => Promise.resolve([activePlan]));
    trainingApi.sessions.mockImplementation(() => Promise.resolve([]));
  });
  afterEach(() => {
    cleanup();
    activeClient?.clear();
    activeClient = undefined;
  });

  it("does not request AI suggestions without ai.assist.read", async () => {
    renderPage();
    await waitFor(() => expect(trainingApi.plans).toHaveBeenCalledWith());
    expect(trainingApi.aiSuggestions).not.toHaveBeenCalled();
  });

  it("shows the empty AI state for an authorized reviewer", async () => {
    trainingApi.aiSuggestions.mockResolvedValue([]);
    renderPage({ user: { role: "coach" }, permissions: ["ai.assist.read"] });
    expect(await screen.findByText("Chưa có gợi ý mới.")).toBeInTheDocument();
  });

  it("completes a plan and renders shared success feedback", async () => {
    trainingApi.updatePlan.mockResolvedValue({ ...activePlan, status: "completed" });
    renderPage();
    const buttons = await screen.findAllByRole("button", { name: "Hoàn thành" }, { timeout: 5000 });
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(trainingApi.updatePlan).toHaveBeenCalledWith("plan-1", { status: "completed" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã hoàn thành giáo án.");
  });

  it("shows an API 409 conflict after plan completion", async () => {
    trainingApi.updatePlan.mockRejectedValue(new ApiError({ status: 409, message: "Giáo án đã hoàn thành." }));
    renderPage();
    const buttons = await screen.findAllByRole("button", { name: "Hoàn thành" }, { timeout: 5000 });
    fireEvent.click(buttons[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Giáo án đã hoàn thành.");
  });
});
