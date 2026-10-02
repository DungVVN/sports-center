import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ptApi } from "../api/pt-api.js";
import { PtPage } from "./PtPage.jsx";

vi.mock("../api/pt-api.js", () => ({
  ptApi: {
    packages: vi.fn(),
    purchases: vi.fn(),
    resources: vi.fn(),
    payment: vi.fn(),
    cancel: vi.fn(),
    assign: vi.fn(),
  },
}));

const purchase = {
  id: "purchase-1",
  package_name_snapshot: "PT 10 buổi",
  status: "active",
  priceVnd: "1000000",
  expires_at: "2099-01-01T00:00:00Z",
  coach_user_id: "coach-1",
  usedSessions: 0,
  remainingSessions: 9,
  session_count_snapshot: 10,
  session_minutes_snapshot: 60,
  cancellation_hours_snapshot: 5,
  appointments: [
    {
      id: "appointment-1",
      status: "scheduled",
      session: { starts_at: "2098-01-01T00:00:00Z" },
    },
  ],
};

function renderPage(role, permissions) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <PtPage session={{ user: { role }, permissions }} />
    </QueryClientProvider>,
  );
}

describe("PT workspace after splitting catalog and purchase components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ptApi.packages.mockResolvedValue([]);
    ptApi.purchases.mockResolvedValue([purchase]);
    ptApi.resources.mockResolvedValue({
      rooms: [],
      coaches: [{ id: "coach-1", display_name: "Coach An" }],
    });
    ptApi.cancel.mockResolvedValue({});
    ptApi.assign.mockResolvedValue({});
  });
  afterEach(cleanup);

  it("keeps member cancellation on the self-service endpoint and hides staff actions", async () => {
    renderPage("member", ["pt.read", "pt.purchase"]);
    await screen.findByText("PT 10 buổi");
    expect(
      screen.queryByRole("button", { name: "Lưu coach" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ghi hoàn thành" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Lý do / nhận xét"), {
      target: { value: "Đổi lịch tập" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Hủy và trả lại buổi" }),
    );
    await waitFor(() =>
      expect(ptApi.cancel).toHaveBeenCalledWith(
        "appointment-1",
        { reason: "Đổi lịch tập" },
        false,
      ),
    );
  });

  it("keeps authorized staff cancellation on the staff endpoint", async () => {
    renderPage("admin", ["pt.read", "pt.manage", "pt.complete"]);
    await screen.findByText("PT 10 buổi");
    expect(
      screen.getByRole("button", { name: "Ghi hoàn thành" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Đặt một buổi PT" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Lý do / nhận xét"), {
      target: { value: "Trung tâm đổi lịch" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Hủy và trả lại buổi" }),
    );
    await waitFor(() =>
      expect(ptApi.cancel).toHaveBeenCalledWith(
        "appointment-1",
        { reason: "Trung tâm đổi lịch" },
        true,
      ),
    );
  });

  it("retains the selected Coach when assigning a purchase", async () => {
    renderPage("admin", ["pt.read", "pt.manage"]);
    await screen.findByText("PT 10 buổi");
    await screen.findByRole("option", { name: "Coach An" });
    fireEvent.change(screen.getByLabelText("Phân công coach"), {
      target: { value: "coach-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu coach" }));
    await waitFor(() =>
      expect(ptApi.assign).toHaveBeenCalledWith("purchase-1", {
        coachUserId: "coach-1",
      }),
    );
  });
});
