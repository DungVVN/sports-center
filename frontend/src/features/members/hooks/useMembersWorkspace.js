import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationFeedback, useSubmitMutation } from "../../../hooks/useMutationFeedback.js";
import { classApi } from "../../classes/class-api.js";
import { memberApi } from "../member-api.js";

const keys = {
  assignmentHistory: (memberId) => ["members", memberId, "coach-assignments"],
  coaches: ["class-coaches"],
  detail: (memberId) => ["members", memberId],
  list: ["members"],
};

function queryMessage(query, fallback) {
  return query.isError ? query.error?.message ?? fallback : "";
}

export function useMembersWorkspace({ assignmentMemberId, editingMemberId }) {
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const membersQuery = useQuery({ queryKey: keys.list, queryFn: memberApi.list });
  const coachesQuery = useQuery({
    queryKey: keys.coaches,
    queryFn: classApi.coaches,
    enabled: Boolean(assignmentMemberId),
  });
  const assignmentHistoryQuery = useQuery({
    queryKey: keys.assignmentHistory(assignmentMemberId),
    queryFn: () => memberApi.coachAssignments(assignmentMemberId),
    enabled: Boolean(assignmentMemberId),
  });
  const detailQuery = useQuery({
    queryKey: keys.detail(editingMemberId),
    queryFn: () => memberApi.get(editingMemberId),
    enabled: Boolean(editingMemberId),
  });

  const invalidateMembers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: keys.list });
  }, [queryClient]);

  const createMember = useSubmitMutation({
    feedback,
    mutationFn: (input) => memberApi.create(input),
    onSuccess: invalidateMembers,
    successMessage: "Đã tạo hồ sơ hội viên.",
    errorMessage: "Không thể tạo hội viên.",
  });
  const assignCoach = useSubmitMutation({
    feedback,
    mutationFn: ({ memberId, input }) => memberApi.assignCoach(memberId, input),
    onSuccess: async (_data, { memberId }) => {
      await Promise.all([
        invalidateMembers(),
        queryClient.invalidateQueries({ queryKey: keys.assignmentHistory(memberId) }),
      ]);
    },
    successMessage: "Đã cập nhật Coach chính.",
    errorMessage: "Không thể phân công Coach.",
  });
  const saveMember = useSubmitMutation({
    feedback,
    mutationFn: async ({ memberId, input, contacts }) => {
      const updated = await memberApi.update(memberId, input);
      await memberApi.replaceContacts(memberId, contacts);
      return updated;
    },
    onSuccess: async (_data, { memberId }) => {
      await Promise.all([
        invalidateMembers(),
        queryClient.invalidateQueries({ queryKey: keys.detail(memberId) }),
      ]);
    },
    successMessage: "Đã cập nhật hồ sơ và liên hệ khẩn cấp.",
    errorMessage: "Không thể cập nhật hội viên.",
  });

  const queries = [membersQuery, coachesQuery, assignmentHistoryQuery, detailQuery];
  const queryError = queries.map((query) => queryMessage(query, "Không thể tải dữ liệu hội viên.")).find(Boolean);

  return {
    assignmentHistory: assignmentHistoryQuery.data ?? [],
    assignmentLoading: coachesQuery.isFetching || assignmentHistoryQuery.isFetching || assignCoach.isPending,
    assignCoach,
    coaches: coachesQuery.data ?? [],
    createMember,
    detail: detailQuery.data ?? null,
    detailLoading: detailQuery.isFetching || saveMember.isPending,
    error: feedback.error || queryError,
    loading: membersQuery.isLoading,
    members: membersQuery.data ?? [],
    notice: feedback.notice,
    reload: membersQuery.refetch,
    saveMember,
  };
}
