import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileAvatar } from "./ProfilePage.jsx";

describe("profile avatar", () => {
  it("shows a fallback when the image URL fails", () => {
    const { rerender } = render(<ProfileAvatar alt="Ảnh đại diện" fallback={<span>NM</span>} src="https://example.com/broken.jpg" />);
    fireEvent.error(screen.getByRole("img", { name: "Ảnh đại diện" }));
    expect(screen.getByText("NM")).toBeInTheDocument();

    rerender(<ProfileAvatar key="new-url" alt="Ảnh đại diện" fallback={<span>NM</span>} src="https://example.com/new.jpg" />);
    expect(screen.getByRole("img", { name: "Ảnh đại diện" })).toBeInTheDocument();
  });
});
