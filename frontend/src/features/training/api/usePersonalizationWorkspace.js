import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationFeedback, useSubmitMutation } from "../../../shared/lib/useMutationFeedback.js";
import { personalizationApi } from "./personalization-api.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";

export function usePersonalizationWorkspace(memberId, self = false) {
  const client = useQueryClient();
  const feedback = useMutationFeedback();
  const reference = useQuery({ queryKey: ["training-personalization", "reference"], queryFn: personalizationApi.reference, enabled: !self });
  const profile = useQuery({ queryKey: ["training-personalization", self ? "mine" : memberId], queryFn: () => self ? personalizationApi.mine() : personalizationApi.profile(memberId), enabled: self || Boolean(memberId) });
  const mutation = useSubmitMutation({ feedback, mutationFn: (task) => task(), onSuccess: async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ["training-personalization"] }), client.invalidateQueries({ queryKey: ["training-plans"] }), client.invalidateQueries({ queryKey: ["member", "training"] })]);
  }, successMessage: "Đã lưu dữ liệu tập luyện.", errorMessage: "Không thể lưu dữ liệu tập luyện." });
  return { reference, profile, mutation, notice: feedback.notice, error: feedback.error || ([reference, profile].find((q) => q.isError) ? errorMessageFor([reference, profile].find((q) => q.isError).error, "Không tải được hồ sơ.") : "") };
}
