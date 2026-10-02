import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { facilityApi } from "../../facilities/index.js";
import { UpcomingSchedule } from "./UpcomingSchedule.jsx";

vi.mock("../../facilities/index.js", () => ({ facilityApi: { mine: vi.fn() } }));
const session = { user: { id: "member-user", role: "member" }, permissions: ["facility.booking.self.read"] };
const bookings = [
  { id: "yoga", status: "confirmed", class_session: { name: "Yoga sáng", starts_at: "2099-01-02T01:00:00Z" } },
  { id: "cancelled", status: "cancelled", class_session: { name: "Lớp đã hủy", starts_at: "2099-01-01T01:00:00Z" } },
];
function renderSchedule(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><UpcomingSchedule bookings={bookings} session={session} {...props} /></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); facilityApi.mine.mockResolvedValue([]); });
afterEach(cleanup);

describe("upcoming member schedule", () => {
  it("combines future classes and own facility requests in date order, excluding cancelled events", async () => {
    facilityApi.mine.mockResolvedValue([
      { id: "field", status: "pending", facilityName: "Sân bóng", date: "2099-01-01", requestedStartMinute: 480, requestedEndMinute: 540 },
      { id: "rejected", status: "rejected", facilityName: "Sân từ chối", date: "2099-01-01", requestedStartMinute: 480, requestedEndMinute: 540 },
    ]);
    const onNavigate = vi.fn();
    renderSchedule({ onNavigate });
    await screen.findByText("Sân bóng");
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Sân bóng");
    expect(items[0]).toHaveTextContent("Chờ duyệt");
    expect(items[1]).toHaveTextContent("Yoga sáng");
    expect(screen.queryByText("Lớp đã hủy")).not.toBeInTheDocument();
    expect(screen.queryByText("Sân từ chối")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem đơn đặt sân" }));
    expect(onNavigate).toHaveBeenCalledWith("facility-calendar");
  });

  it("does not request facility data without own-reservation permission", () => {
    renderSchedule({ session: { user: session.user, permissions: ["booking.read"] } });
    expect(screen.getByText("Yoga sáng")).toBeInTheDocument();
    expect(facilityApi.mine).not.toHaveBeenCalled();
  });

  it("keeps the class schedule available when facility loading fails", async () => {
    facilityApi.mine.mockRejectedValue(new Error("network unavailable"));
    renderSchedule();
    await screen.findByRole("alert");
    expect(screen.getByText("Yoga sáng")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại lịch sân" })).toBeInTheDocument();
  });
});
