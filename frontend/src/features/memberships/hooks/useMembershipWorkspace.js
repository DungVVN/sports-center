import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memberApi } from "../../members/member-api.js";
import { membershipApi } from "../membership-api.js";

const keys = {
  packages: ["membership-packages"],
  members: ["members"],
  freezeRequests: ["membership-freeze-requests", "pending"],
  mine: ["memberships", "mine"],
  byMember: (memberId) => ["memberships", "member", memberId],
};

export function useMembershipWorkspace({ canAssignMembership, canReviewFreeze, isManager, isMember, selectedMemberId }) {
  const queryClient = useQueryClient();
  const packagesQuery = useQuery({ queryKey: keys.packages, queryFn: membershipApi.packages, enabled: !isMember });
  const membersQuery = useQuery({ queryKey: keys.members, queryFn: memberApi.list, enabled: !isMember && (!isManager || canAssignMembership) });
  const freezeRequestsQuery = useQuery({ queryKey: keys.freezeRequests, queryFn: () => membershipApi.freezeRequests("pending"), enabled: !isMember && canReviewFreeze });
  const mineQuery = useQuery({ queryKey: keys.mine, queryFn: membershipApi.mine, enabled: isMember });
  const memberMembershipsQuery = useQuery({ queryKey: keys.byMember(selectedMemberId), queryFn: () => membershipApi.byMember(selectedMemberId), enabled: !isMember && Boolean(selectedMemberId) });

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.packages }),
      queryClient.invalidateQueries({ queryKey: keys.members }),
      queryClient.invalidateQueries({ queryKey: keys.freezeRequests }),
      queryClient.invalidateQueries({ queryKey: keys.mine }),
      queryClient.invalidateQueries({ queryKey: ["memberships", "member"] }),
    ]);
  }, [queryClient]);

  const reload = useCallback(async () => {
    await Promise.all([
      ...(isMember ? [mineQuery.refetch()] : [packagesQuery.refetch()]),
      ...(!isMember && (!isManager || canAssignMembership) ? [membersQuery.refetch()] : []),
      ...(!isMember && canReviewFreeze ? [freezeRequestsQuery.refetch()] : []),
      ...(!isMember && selectedMemberId ? [memberMembershipsQuery.refetch()] : []),
    ]);
  }, [canAssignMembership, canReviewFreeze, freezeRequestsQuery, isManager, isMember, memberMembershipsQuery, membersQuery, mineQuery, packagesQuery, selectedMemberId]);

  const createPackage = useMutation({ mutationFn: membershipApi.createPackage, onSuccess: invalidate });
  const updatePackage = useMutation({ mutationFn: ({ id, input }) => membershipApi.updatePackage(id, input), onSuccess: invalidate });
  const createMembership = useMutation({ mutationFn: ({ memberId, input }) => membershipApi.create(memberId, input), onSuccess: invalidate });
  const requestFreeze = useMutation({ mutationFn: ({ id, input }) => membershipApi.requestFreeze(id, input), onSuccess: invalidate });
  const reviewFreeze = useMutation({ mutationFn: ({ id, approved }) => membershipApi.reviewFreeze(id, approved), onSuccess: invalidate });
  const cancelPendingRenewal = useMutation({ mutationFn: membershipApi.cancelPendingRenewal, onSuccess: invalidate });

  const queries = [packagesQuery, membersQuery, freezeRequestsQuery, mineQuery, memberMembershipsQuery];
  const error = queries.find((query) => query.isError)?.error?.message ?? "";

  return {
    cancelPendingRenewal,
    createMembership,
    createPackage,
    error,
    freezeRequests: freezeRequestsQuery.data ?? [],
    loading: queries.some((query) => query.isLoading),
    members: membersQuery.data ?? [],
    memberships: isMember ? mineQuery.data ?? [] : memberMembershipsQuery.data ?? [],
    packages: packagesQuery.data ?? [],
    reload,
    requestFreeze,
    reviewFreeze,
    updatePackage,
  };
}
