import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ClassChangeReview } from "./ClassChangeReview.jsx";

afterEach(cleanup);
it("keeps publish and edit available when a class manager also reviews changes", () => {
  const publish = vi.fn(), openEdit = vi.fn(), review = vi.fn();
  const row = { id: "class-1", name: "Yoga QA", status: "draft", capacity: 10, starts_at: "2099-04-01T01:00:00Z" };
  render(<ClassChangeReview canManage canReview role="admin" requests={[{ id: "request-1", type: "cancel", reason: "Đổi lịch QA" }]} review={review} publish={publish} openEdit={openEdit} coaches={[]} rooms={[]} visibleClassRows={[row]} classCoachFilters={[]} classRoomFilters={[]} classStatusFilters={[]} classSearch="" classSort={{ key: "starts_at", direction: "asc" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Công bố" }));
  fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
  fireEvent.click(screen.getByRole("button", { name: "Duyệt" }));
  expect(publish).toHaveBeenCalledWith(row.id);
  expect(openEdit).toHaveBeenCalledWith(row);
  expect(review).toHaveBeenCalledWith("request-1", true);
});
