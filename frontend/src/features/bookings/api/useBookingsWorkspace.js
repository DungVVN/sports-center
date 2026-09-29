import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationFeedback, useSubmitMutation } from "../../../shared/lib/useMutationFeedback.js";
import { classApi } from "../../classes/index.js";
import { memberApi } from "../../members/index.js";
import { bookingApi } from "./booking-api.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";

const keys = {
  bookings: (memberId) => ["bookings", memberId ?? "all"],
  classes: ["classes"],
  members: ["members"],
};

export function useBookingsWorkspace({ canCreateBooking, isMember, memberId }) {
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const bookingsQuery = useQuery({ queryKey: keys.bookings(isMember ? "mine" : memberId), queryFn: () => bookingApi.list(isMember ? undefined : memberId) });
  const classesQuery = useQuery({ queryKey: keys.classes, queryFn: classApi.list, enabled: canCreateBooking });
  const membersQuery = useQuery({ queryKey: keys.members, queryFn: memberApi.list, enabled: canCreateBooking && !isMember });
  const invalidateBookings = useCallback(async () => { await queryClient.invalidateQueries({ queryKey: ["bookings"] }); }, [queryClient]);
  const createBooking = useSubmitMutation({
    feedback,
    mutationFn: (input) => bookingApi.create(input),
    onSuccess: invalidateBookings,
    successMessage: (booking) => booking.status === "waitlisted" ? "Lớp đã đủ chỗ. Hội viên đã vào danh sách chờ và sẽ được thông báo khi đủ điều kiện nhận chỗ trống." : "Đặt chỗ thành công.",
    errorMessage: "Không thể đặt chỗ.",
  });
  const cancelBooking = useSubmitMutation({
    feedback,
    mutationFn: ({ id, reason }) => bookingApi.cancel(id, reason),
    onSuccess: invalidateBookings,
    successMessage: (result) => result.promotedBookingId
      ? "Đã hủy đặt chỗ và tự động xác nhận hội viên đủ điều kiện trong danh sách chờ."
      : "Đã hủy đặt chỗ.",
    errorMessage: "Không thể hủy đặt chỗ.",
  });
  const failedQuery = [bookingsQuery, classesQuery, membersQuery].find((query) => query.isError);
  const queryError = failedQuery ? errorMessageFor(failedQuery.error, "Không thể tải dữ liệu đặt chỗ.") : "";
  return {
    bookings: bookingsQuery.data ?? [],
    cancelBooking,
    classes: classesQuery.data ?? [],
    createBooking,
    error: feedback.error || queryError,
    loading: bookingsQuery.isLoading,
    members: membersQuery.data ?? [],
    notice: feedback.notice,
    reload: bookingsQuery.refetch,
    setError: feedback.setError,
  };
}
