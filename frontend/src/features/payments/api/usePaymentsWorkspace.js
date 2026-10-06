import { useCallback } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationFeedback, useSubmitMutation } from "../../../shared/lib/useMutationFeedback.js";
import { memberApi } from "../../members/index.js";
import { paymentApi } from "./payment-api.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";

const keys = {
  members: ["members"],
  targets: (memberId) => ["payment-targets", memberId],
  payments: (memberId) => ["payments", memberId ?? "all"],
};

export function usePaymentsWorkspace({ isCashier, memberId, listQuery }) {
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const paymentsQuery = useQuery({
    queryKey: [...keys.payments(memberId), "page", listQuery],
    queryFn: () => paymentApi.page({ ...listQuery, memberId }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const membersQuery = useQuery({ queryKey: keys.members, queryFn: memberApi.list, enabled: isCashier });
  const targetsQuery = useQuery({
    queryKey: keys.targets(memberId),
    queryFn: () => paymentApi.targets(memberId),
    enabled: isCashier && Boolean(memberId),
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["payments"] }),
      ...[
        "payment-targets",
        "pt-purchases",
        "facility-reservations-staff",
        "facility-reservations-me",
        "facility-calendar",
      ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      queryClient.invalidateQueries({ queryKey: ["memberships"] }),
      queryClient.invalidateQueries({ queryKey: ["member", "payments"] }),
      queryClient.invalidateQueries({ queryKey: ["members"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["course-enrollments"] }),
      queryClient.invalidateQueries({ queryKey: ["bookings"] }),
    ]);
  }, [queryClient]);
  const createPayment = useSubmitMutation({
    feedback,
    mutationFn: (input) => paymentApi.create(input),
    onSuccess: invalidate,
    successMessage: (payment, input) =>
      payment.checkoutUrl
        ? "Đã tạo liên kết PayOS. Mở liên kết để khách thanh toán."
        : input.method === "bank_transfer"
          ? "Đã lập phiếu chuyển khoản chờ đối soát sao kê."
          : "Đã lập phiếu thu tiền mặt, chờ Lễ tân xác nhận đã thu.",
    errorMessage: "Không thể lập phiếu thu.",
  });
  const confirmPayment = useSubmitMutation({
    feedback,
    mutationFn: ({ id, status, reconciliationNote }) => paymentApi.confirm(id, status, reconciliationNote),
    onSuccess: invalidate,
    successMessage: (payment, { status, method }) =>
      payment.fulfillment_error
        ? "Đã thu tiền nhưng dịch vụ cần đối soát trước khi kích hoạt."
        : status === "paid"
          ? method === "bank_transfer"
            ? "Đã đối soát sao kê, xác nhận thanh toán và kích hoạt dịch vụ."
            : "Đã xác nhận thanh toán và kích hoạt dịch vụ."
          : "Đã ghi nhận giao dịch không thành công.",
    errorMessage: "Không thể xác nhận phiếu thu.",
  });
  const failedQuery = [paymentsQuery, membersQuery, targetsQuery].find((query) => query.isError);
  const queryError = failedQuery ? errorMessageFor(failedQuery.error, "Không tải được dữ liệu thanh toán.") : "";
  return {
    confirmPayment,
    createPayment,
    error: feedback.error || queryError,
    loading: paymentsQuery.isLoading,
    members: membersQuery.data ?? [],
    targets: targetsQuery.data ?? [],
    targetsUnavailable:
      Boolean(memberId) && (targetsQuery.isPending || targetsQuery.isFetching || targetsQuery.isError),
    notice: feedback.notice,
    payments: paymentsQuery.data?.items ?? [],
    listMeta: paymentsQuery.data?.meta,
    pagePending: paymentsQuery.isFetching,
    reload: () => Promise.all([paymentsQuery.refetch(), ...(isCashier && memberId ? [targetsQuery.refetch()] : [])]),
    setError: feedback.setError,
  };
}
