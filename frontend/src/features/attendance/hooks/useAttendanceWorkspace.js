import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationFeedback, useSubmitMutation } from "../../../hooks/useMutationFeedback.js";
import { bookingApi } from "../../bookings/booking-api.js";
import { classApi } from "../../classes/class-api.js";
import { attendanceApi } from "../attendance-api.js";
import { errorMessageFor } from "../../../api/error-message.js";

const keys = { classes: ["classes"], bookings: (classId) => ["classes", classId, "bookings"], records: (classId) => ["classes", classId, "attendance"] };

export function useAttendanceWorkspace({ classId }) {
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const classesQuery = useQuery({ queryKey: keys.classes, queryFn: classApi.list });
  const bookingsQuery = useQuery({ queryKey: keys.bookings(classId), queryFn: () => bookingApi.byClass(classId), enabled: Boolean(classId) });
  const recordsQuery = useQuery({ queryKey: keys.records(classId), queryFn: () => attendanceApi.byClass(classId), enabled: Boolean(classId) });
  const invalidateSelected = useCallback(async () => {
    if (!classId) return;
    await Promise.all([queryClient.invalidateQueries({ queryKey: keys.bookings(classId) }), queryClient.invalidateQueries({ queryKey: keys.records(classId) })]);
  }, [classId, queryClient]);
  const submitAttendance = useSubmitMutation({ feedback, mutationFn: ({ classId: targetClassId, entries }) => attendanceApi.submit(targetClassId, entries), onSuccess: invalidateSelected, successMessage: (result) => result.alreadySubmitted ? "Buổi học này đã được lưu trước đó." : `Đã lưu điểm danh và gửi thông báo cho ${result.notificationCount} hội viên.`, errorMessage: "Không thể lưu điểm danh." });
  const correctAttendance = useSubmitMutation({ feedback, mutationFn: ({ id, input }) => attendanceApi.correct(id, input), onSuccess: invalidateSelected, successMessage: "Đã sửa điểm danh và lưu audit.", errorMessage: "Không thể sửa điểm danh." });
  const checkOutAttendance = useSubmitMutation({ feedback, mutationFn: attendanceApi.checkOut, onSuccess: invalidateSelected, successMessage: "Đã check-out buổi học.", errorMessage: "Không thể check-out buổi học." });
  const failedQuery = [classesQuery, bookingsQuery, recordsQuery].find((query) => query.isError);
  const queryError = failedQuery ? errorMessageFor(failedQuery.error, "Không thể tải dữ liệu điểm danh.") : "";
  return { bookings: bookingsQuery.data ?? [], checkOutAttendance, classes: classesQuery.data ?? [], classesLoading: classesQuery.isLoading, correctAttendance, detailsLoading: bookingsQuery.isFetching || recordsQuery.isFetching, error: feedback.error || queryError, notice: feedback.notice, records: recordsQuery.data ?? [], reload: invalidateSelected, setError: feedback.setError, setNotice: feedback.setNotice, submitAttendance };
}
