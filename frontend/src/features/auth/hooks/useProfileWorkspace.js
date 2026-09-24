import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationFeedback, useSubmitMutation } from "../../../hooks/useMutationFeedback.js";
import { authApi } from "../auth-api.js";

const profileKey = ["auth", "profile"];

export function useProfileWorkspace({ onProfileSaved }) {
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const profileQuery = useQuery({ queryKey: profileKey, queryFn: authApi.profile });
  const saveProfile = useSubmitMutation({
    feedback,
    mutationFn: (input) => authApi.updateProfile(input),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey, profile);
      onProfileSaved?.();
    },
    successMessage: "Đã cập nhật hồ sơ cá nhân.",
    errorMessage: "Không thể cập nhật hồ sơ cá nhân.",
  });
  const changePassword = useSubmitMutation({
    feedback,
    mutationFn: (input) => authApi.changePassword(input),
    successMessage: "Đã đổi mật khẩu. Các phiên đăng nhập khác đã được thu hồi.",
    errorMessage: "Không thể đổi mật khẩu.",
  });

  return {
    changePassword,
    clearFeedback: feedback.clear,
    error: feedback.error || profileQuery.error?.message || "",
    loading: profileQuery.isLoading,
    notice: feedback.notice,
    profile: profileQuery.data ?? null,
    reload: profileQuery.refetch,
    saveProfile,
    setError: feedback.setError,
  };
}
