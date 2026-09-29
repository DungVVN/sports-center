import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationFeedback, useSubmitMutation } from "../../../shared/lib/useMutationFeedback.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { trainingApi } from "./training-api.js";

const keys = { ai: ["ai-assist", "suggestions"], members: ["training-members"], plans: ["training-plans"], sessions: (planId) => ["training-plans", planId, "sessions"], templates: ["training-templates"] };

export function useTrainingWorkspace({ canViewAi, planId }) {
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const templatesQuery = useQuery({ queryKey: keys.templates, queryFn: trainingApi.templates });
  const membersQuery = useQuery({ queryKey: keys.members, queryFn: trainingApi.members });
  // React Query passes a QueryFunctionContext to queryFn.  Do not hand that
  // object to plans(memberId), otherwise it becomes `memberId=[object Object]`.
  const plansQuery = useQuery({ queryKey: keys.plans, queryFn: () => trainingApi.plans() });
  const aiQuery = useQuery({ queryKey: keys.ai, queryFn: trainingApi.aiSuggestions, enabled: canViewAi });
  const sessionsQuery = useQuery({ queryKey: keys.sessions(planId), queryFn: () => trainingApi.sessions(planId), enabled: Boolean(planId) });
  const invalidate = useCallback(async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: keys.templates }), queryClient.invalidateQueries({ queryKey: keys.members }), queryClient.invalidateQueries({ queryKey: keys.plans }), queryClient.invalidateQueries({ queryKey: ["training-plans"] }), queryClient.invalidateQueries({ queryKey: keys.ai })]);
  }, [queryClient]);
  const runAction = useSubmitMutation({ feedback, mutationFn: ({ task }) => task(), onSuccess: invalidate, successMessage: (_data, { success }) => success, errorMessage: "Không thể cập nhật dữ liệu tập luyện." });
  const failedQuery = [templatesQuery, membersQuery, plansQuery, aiQuery, sessionsQuery].find((query) => query.isError);
  const queryError = failedQuery ? errorMessageFor(failedQuery.error, "Không thể tải dữ liệu tập luyện.") : "";
  return { aiDrafts: canViewAi ? aiQuery.data ?? [] : [], error: feedback.error || queryError, members: membersQuery.data ?? [], notice: feedback.notice, plans: plansQuery.data ?? [], reload: invalidate, runAction, sessions: sessionsQuery.data ?? [], templates: templatesQuery.data ?? [] };
}
