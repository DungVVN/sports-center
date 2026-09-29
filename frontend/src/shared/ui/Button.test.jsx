import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button.jsx";

describe("Button", () => {
  it("uses the approved primary button variant and disabled state", () => {
    render(<Button disabled>Lưu thay đổi</Button>);
    const button = screen.getByRole("button", { name: "Lưu thay đổi" });
    expect(button).toBeDisabled();
    expect(button).toHaveClass("button--primary", "button--md");
  });
});
