import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { classApi } from "./class-api.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";

const queryKeys = {
  classes: ["classes"],
  rooms: ["class-rooms"],
  coaches: ["class-coaches"],
  requests: ["class-change-requests", "pending"],
};

export function useClassesWorkspace({ canReview }) {
  const queryClient = useQueryClient();
  const classesQuery = useQuery({ queryKey: queryKeys.classes, queryFn: classApi.list });
  const roomsQuery = useQuery({ queryKey: queryKeys.rooms, queryFn: classApi.rooms });
  const coachesQuery = useQuery({ queryKey: queryKeys.coaches, queryFn: classApi.coaches });
  const requestsQuery = useQuery({
    queryKey: queryKeys.requests,
    queryFn: () => classApi.changeRequests("pending"),
    enabled: canReview,
  });

  const reload = useCallback(async () => {
    await Promise.all([
      classesQuery.refetch(),
      roomsQuery.refetch(),
      coachesQuery.refetch(),
      ...(canReview ? [requestsQuery.refetch()] : []),
    ]);
  }, [canReview, classesQuery, coachesQuery, requestsQuery, roomsQuery]);

  const invalidateWorkspace = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.classes }),
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms }),
      queryClient.invalidateQueries({ queryKey: queryKeys.coaches }),
      ...(canReview ? [queryClient.invalidateQueries({ queryKey: queryKeys.requests })] : []),
    ]);
  }, [canReview, queryClient]);

  const createClass = useMutation({ mutationFn: classApi.create, onSuccess: invalidateWorkspace });
  const publishClass = useMutation({ mutationFn: classApi.publish, onSuccess: invalidateWorkspace });
  const updateClass = useMutation({ mutationFn: ({ id, input }) => classApi.update(id, input), onSuccess: invalidateWorkspace });
  const requestChange = useMutation({ mutationFn: ({ id, input }) => classApi.requestChange(id, input), onSuccess: invalidateWorkspace });
  const reviewChange = useMutation({ mutationFn: ({ id, approved }) => classApi.reviewChange(id, approved), onSuccess: invalidateWorkspace });

  const failedQuery = [classesQuery, roomsQuery, coachesQuery, requestsQuery].find((query) => query.isError);
  const queryError = failedQuery ? errorMessageFor(failedQuery.error, "Không thể tải dữ liệu lớp học.") : "";

  return {
    classes: classesQuery.data ?? [],
    coaches: coachesQuery.data ?? [],
    createClass,
    error: queryError,
    loading: classesQuery.isLoading || roomsQuery.isLoading || coachesQuery.isLoading || (canReview && requestsQuery.isLoading),
    publishClass,
    reload,
    requests: canReview ? requestsQuery.data ?? [] : [],
    requestChange,
    reviewChange,
    rooms: roomsQuery.data ?? [],
    updateClass,
  };
}
