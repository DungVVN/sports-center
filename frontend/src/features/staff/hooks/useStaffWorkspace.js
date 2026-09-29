import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationFeedback, useSubmitMutation } from "../../../hooks/useMutationFeedback.js";
import { staffApi } from "../staff-api.js";
import { errorMessageFor } from "../../../api/error-message.js";

const keys = { detail: (id) => ["staff", id], list: ["staff"] };

export function useStaffWorkspace({ editingId }) {
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const staffQuery = useQuery({ queryKey: keys.list, queryFn: staffApi.list });
  const detailQuery = useQuery({ queryKey: keys.detail(editingId), queryFn: () => staffApi.get(editingId), enabled: Boolean(editingId) });
  const invalidate = useCallback(async () => { await queryClient.invalidateQueries({ queryKey: keys.list }); }, [queryClient]);
  const createStaff = useSubmitMutation({ feedback, mutationFn: (input) => staffApi.create(input), onSuccess: invalidate, successMessage: "Đã tạo nhân viên.", errorMessage: "Không thể tạo nhân viên." });
  const updateStaff = useSubmitMutation({ feedback, mutationFn: ({ id, input }) => staffApi.update(id, input), onSuccess: invalidate, successMessage: "Đã cập nhật nhân viên.", errorMessage: "Không thể cập nhật nhân viên." });
  const updateStatus = useSubmitMutation({ feedback, mutationFn: ({ id, status }) => staffApi.setStatus(id, status), onSuccess: invalidate, successMessage: "Đã cập nhật trạng thái nhân viên.", errorMessage: "Không thể cập nhật trạng thái." });
  const resetPassword = useSubmitMutation({ feedback, mutationFn: staffApi.resetPassword, successMessage: "Đã cấp lại mật khẩu tạm cho nhân viên.", errorMessage: "Không thể cấp lại mật khẩu." });
  const failedQuery = [staffQuery, detailQuery].find((query) => query.isError);
  const queryError = failedQuery ? errorMessageFor(failedQuery.error, "Không thể tải dữ liệu nhân viên.") : "";
  return { clearFeedback: feedback.clear, createStaff, detail: detailQuery.data ?? null, detailLoading: detailQuery.isFetching || updateStaff.isPending, error: feedback.error || queryError, loading: staffQuery.isLoading, notice: feedback.notice, reload: staffQuery.refetch, resetPassword, staff: staffQuery.data ?? [], updateStaff, updateStatus };
}
