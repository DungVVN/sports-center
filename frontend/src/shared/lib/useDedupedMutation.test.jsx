import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDedupedMutation } from "./useDedupedMutation.js";

describe("useDedupedMutation", () => {
  it("sends one request for repeated identical actions while the first is pending", async () => {
    let finish;
    const mutationFn = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useDedupedMutation({ mutationFn }), { wrapper });
    let first;
    let second;
    await act(async () => {
      first = result.current.mutateAsync({ code: "A" });
      second = result.current.mutateAsync({ code: "A" });
      await Promise.resolve();
    });
    expect(mutationFn).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ id: "created" }); await Promise.all([first, second]); });
  });
});
