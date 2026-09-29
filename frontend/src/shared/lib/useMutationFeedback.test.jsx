import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "../ui/ToastContext.jsx";
import { useMutationFeedback } from "./useMutationFeedback.js";

describe("useMutationFeedback", () => {
  it("shows success and failure messages on screen and preserves inline feedback", () => {
    const client = new QueryClient();
    const wrapper = ({ children }) => <QueryClientProvider client={client}><ToastProvider>{children}</ToastProvider></QueryClientProvider>;
    const { result } = renderHook(() => useMutationFeedback(), { wrapper });

    act(() => result.current.setNotice("Đã lưu phiếu thu."));
    expect(result.current.notice).toBe("Đã lưu phiếu thu.");
    expect(screen.getByRole("status")).toHaveTextContent("Đã lưu phiếu thu.");

    act(() => result.current.setError("Số tiền không khớp giá gói."));
    expect(result.current.error).toBe("Số tiền không khớp giá gói.");
    expect(screen.getByRole("alert")).toHaveTextContent("Số tiền không khớp giá gói.");
  });
});
