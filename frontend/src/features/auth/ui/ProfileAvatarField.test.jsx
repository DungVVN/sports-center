import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileAvatarField } from "./ProfileAvatarField.jsx";

afterEach(cleanup);

describe("profile avatar picker", () => {
  it("shows the URL filename without an image preview", () => {
    render(<ProfileAvatarField value="https://example.com/photos/avatar%20admin.png?version=2" onChange={vi.fn()} onUpload={vi.fn()} />);
    expect(screen.getByText("avatar admin.png")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chọn ảnh" })).toHaveClass("button--outline");
  });

  it("shows the original filename after a successful upload", async () => {
    const url = "https://example.com/generated-id.png";
    const upload = vi.fn().mockResolvedValue(url);
    const { rerender } = render(<ProfileAvatarField value="" onChange={vi.fn()} onUpload={upload} />);
    fireEvent.change(screen.getByLabelText("Chọn file ảnh đại diện"), { target: { files: [new File(["image"], "anh-ca-nhan.png", { type: "image/png" })] } });
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    rerender(<ProfileAvatarField value={url} onChange={vi.fn()} onUpload={upload} />);
    expect(await screen.findByText("anh-ca-nhan.png")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("keeps the existing image name when upload fails", async () => {
    const upload = vi.fn().mockResolvedValue(undefined);
    render(<ProfileAvatarField value="https://example.com/current.png" onChange={vi.fn()} onUpload={upload} />);
    fireEvent.change(screen.getByLabelText("Chọn file ảnh đại diện"), { target: { files: [new File(["invalid"], "failed.png")] } });
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    expect(screen.getByText("current.png")).toBeInTheDocument();
    expect(screen.queryByText("failed.png")).not.toBeInTheDocument();
  });
});
