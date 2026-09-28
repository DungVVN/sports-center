import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationFeedback, useSubmitMutation } from "../../../hooks/useMutationFeedback.js";
import { supportApi } from "../support-api.js";
import { errorMessageFor } from "../../../api/error-message.js";

const keys = {
  detail: (id) => ["support-tickets", id],
  list: ["support-tickets"],
};

export function useSupportWorkspace({ selectedId }) {
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const ticketsQuery = useQuery({ queryKey: keys.list, queryFn: supportApi.list });
  const detailQuery = useQuery({
    queryKey: keys.detail(selectedId),
    queryFn: () => supportApi.detail(selectedId),
    enabled: Boolean(selectedId),
  });
  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.list }),
      selectedId ? queryClient.invalidateQueries({ queryKey: keys.detail(selectedId) }) : Promise.resolve(),
    ]);
  }, [queryClient, selectedId]);

  const createTicket = useSubmitMutation({
    feedback,
    mutationFn: (input) => supportApi.create(input),
    onSuccess: invalidate,
    successMessage: "Đã gửi yêu cầu hỗ trợ.",
    errorMessage: "Không thể gửi yêu cầu hỗ trợ.",
  });
  const assignSelf = useSubmitMutation({
    feedback,
    mutationFn: (id) => supportApi.assignSelf(id),
    onSuccess: invalidate,
    successMessage: "Đã nhận phụ trách ticket.",
    errorMessage: "Không thể nhận phụ trách ticket.",
  });
  const respond = useSubmitMutation({
    feedback,
    mutationFn: ({ id, input }) => supportApi.respond(id, input),
    onSuccess: invalidate,
    successMessage: "Đã gửi phản hồi cho hội viên.",
    errorMessage: "Không thể gửi phản hồi.",
  });
  const failedQuery = [ticketsQuery, detailQuery].find((query) => query.isError);
  const queryError = failedQuery ? errorMessageFor(failedQuery.error, "Không thể tải yêu cầu hỗ trợ.") : "";

  return {
    assignSelf,
    createTicket,
    detail: detailQuery.data ?? null,
    error: feedback.error || queryError,
    notice: feedback.notice,
    reload: ticketsQuery.refetch,
    respond,
    tickets: ticketsQuery.data ?? [],
  };
}
