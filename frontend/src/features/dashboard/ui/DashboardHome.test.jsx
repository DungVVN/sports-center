import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardHome } from "./DashboardHome.jsx";
import { dashboardApi } from "../api/dashboard-api.js";

vi.mock("../api/dashboard-api.js", () => ({ dashboardApi: { summary: vi.fn() } }));

function show(role, summary) {
  dashboardApi.summary.mockResolvedValue(summary);
  const onNavigate = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><DashboardHome role={role} onNavigate={onNavigate} /></QueryClientProvider>);
  return onNavigate;
}

describe("role dashboard counters", () => {
  it("makes the member class and membership counters explicit about their date window", async () => {
    show("member", { todayClasses: 2, pendingPayments: 0, expiringMemberships: 1 });
    const classes = (await screen.findByText("Lớp học hôm nay")).closest('[role="button"]');
    const expiring = screen.getByText("Gói hết hạn trong 7 ngày").closest('[role="button"]');
    expect(within(classes).getByText("2")).toBeInTheDocument();
    expect(within(expiring).getByText("1")).toBeInTheDocument();
  });
  afterEach(cleanup);
  beforeEach(() => vi.clearAllMocks());

  it("shows real scoped coach totals and links to the corresponding lists", async () => {
    const navigate = show("coach", { todayClasses: 1, assignedClasses: 6, trainingPlans: 3, pendingPayments: 0, expiringMemberships: 0 });
    const classes = (await screen.findByText("Lớp tôi phụ trách")).closest('[role="button"]');
    const plans = screen.getByText("Giáo án trong phạm vi").closest('[role="button"]');
    expect(within(classes).getByText("6")).toBeInTheDocument();
    expect(within(plans).getByText("3")).toBeInTheDocument();
    fireEvent.click(classes);
    fireEvent.click(plans);
    expect(navigate.mock.calls).toEqual([["classes"], ["training"]]);
  });

  it("labels member receipts as pending rather than total receipts", async () => {
    const navigate = show("member", { todayClasses: 0, pendingPayments: 0, expiringMemberships: 0 });
    const card = (await screen.findByText("Phiếu thu chờ xác nhận")).closest('[role="button"]');
    expect(within(card).getByText("0")).toBeInTheDocument();
    fireEvent.click(card);
    expect(navigate).toHaveBeenCalledWith("my-payments");
  });

  it("displays the cash-only count for the front desk", async () => {
    show("receptionist", { todayClasses: 1, pendingPayments: 10, expiringMemberships: 0 });
    const card = (await screen.findByText("Tiền mặt chờ xác nhận")).closest('[role="button"]');
    expect(within(card).getByText("10")).toBeInTheDocument();
  });
});
