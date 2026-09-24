import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "../api/api-error.js";

function messageFor(error, fallback) {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

export function useMutationFeedback() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const clear = useCallback(() => {
    setError("");
    setNotice("");
  }, []);

  return useMemo(() => ({ clear, error, notice, setError, setNotice }), [clear, error, notice]);
}

export function useSubmitMutation({ feedback, mutationFn, onSuccess, successMessage, errorMessage }) {
  return useMutation({
    mutationFn,
    onMutate: () => feedback.clear(),
    onSuccess: async (data, variables, context) => {
      await onSuccess?.(data, variables, context);
      const message = typeof successMessage === "function"
        ? successMessage(data, variables)
        : successMessage;
      if (message) feedback.setNotice(message);
    },
    onError: (error) => feedback.setError(messageFor(error, errorMessage)),
  });
}
