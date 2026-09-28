import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";

export function useDedupedMutation({ mutationFn, ...options }) {
  const inFlight = useRef(new Map());
  return useMutation({
    ...options,
    mutationFn: (variables) => {
      const key = JSON.stringify(variables);
      if (inFlight.current.has(key)) return inFlight.current.get(key);
      const pending = Promise.resolve().then(() => mutationFn(variables));
      inFlight.current.set(key, pending);
      void pending.finally(() => {
        if (inFlight.current.get(key) === pending) inFlight.current.delete(key);
      }).catch(() => {});
      return pending;
    },
  });
}
