import { useCallback, useMemo, useState } from "react";
import { errorMessageFor } from "../api/error-message.js";
import { useDedupedMutation } from "./useDedupedMutation.js";
import { useToast } from "../contexts/useToast.js";

export function useMutationFeedback() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const showToast = useToast();
  const reportError = useCallback((message) => {
    setError(message);
    if (message) showToast?.(message, "error");
  }, [showToast]);
  const reportNotice = useCallback((message, type = "success") => {
    setNotice(message);
    if (message) showToast?.(message, type);
  }, [showToast]);
  const clear = useCallback(() => {
    setError("");
    setNotice("");
  }, []);

  return useMemo(() => ({ clear, error, notice, setError: reportError, setNotice: reportNotice }), [clear, error, notice, reportError, reportNotice]);
}

export function useSubmitMutation({ feedback, mutationFn, onSuccess, successMessage, errorMessage }) {
  return useDedupedMutation({
    mutationFn,
    onMutate: () => feedback.clear(),
    onSuccess: async (data, variables, context) => {
      await onSuccess?.(data, variables, context);
      const message = typeof successMessage === "function"
        ? successMessage(data, variables)
        : successMessage;
      if (message) feedback.setNotice(message);
    },
    onError: (error) => feedback.setError(typeof errorMessage === "function" ? errorMessage(error) : errorMessageFor(error, errorMessage)),
  });
}
