import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationFeedback, useSubmitMutation } from "../../../hooks/useMutationFeedback.js";
import { memberApi } from "../../members/member-api.js";
import { membershipApi } from "../../memberships/membership-api.js";
import { paymentApi } from "../payment-api.js";
import { errorMessageFor } from "../../../api/error-message.js";

const keys = { members: ["members"], memberships: (memberId) => ["memberships", "member", memberId], payments: (memberId) => ["payments", memberId ?? "all"] };

export function usePaymentsWorkspace({ isCashier, memberId }) {
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const paymentsQuery = useQuery({ queryKey: keys.payments(memberId), queryFn: () => paymentApi.list(memberId), refetchInterval: 30_000 });
  const membersQuery = useQuery({ queryKey: keys.members, queryFn: memberApi.list, enabled: isCashier });
  const membershipsQuery = useQuery({ queryKey: keys.memberships(memberId), queryFn: () => membershipApi.byMember(memberId), enabled: isCashier && Boolean(memberId) });
  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["payments"] }),
      queryClient.invalidateQueries({ queryKey: ["memberships"] }),
      queryClient.invalidateQueries({ queryKey: ["member", "payments"] }),
      queryClient.invalidateQueries({ queryKey: ["members"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
    ]);
  }, [queryClient]);
  const createPayment = useSubmitMutation({ feedback, mutationFn: (input) => paymentApi.create(input), onSuccess: invalidate, successMessage: (payment, input) => payment.checkoutUrl ? "Đã tạo liên kết PayOS. Mở liên kết để khách thanh toán." : input.method === "bank_transfer" ? "Đã lập phiếu chuyển khoản chờ đối soát sao kê." : "Đã lập phiếu thu tiền mặt, chờ Lễ tân xác nhận đã thu.", errorMessage: "Không thể lập phiếu thu." });
  const confirmPayment = useSubmitMutation({ feedback, mutationFn: ({ id, status, reconciliationNote }) => paymentApi.confirm(id, status, reconciliationNote), onSuccess: invalidate, successMessage: (_payment, { status, method }) => status === "paid" ? method === "bank_transfer" ? "Đã đối soát sao kê, xác nhận thanh toán và kích hoạt gói tập." : "Đã xác nhận thanh toán và kích hoạt gói tập." : "Đã ghi nhận giao dịch không thành công.", errorMessage: "Không thể xác nhận phiếu thu." });
  const failedQuery = [paymentsQuery, membersQuery, membershipsQuery].find((query) => query.isError);
  const queryError = failedQuery ? errorMessageFor(failedQuery.error, "Không tải được dữ liệu thanh toán.") : "";
  return { confirmPayment, createPayment, error: feedback.error || queryError, loading: paymentsQuery.isLoading, members: membersQuery.data ?? [], memberships: (membershipsQuery.data ?? []).filter((item) => item.status === "pending_payment"), notice: feedback.notice, payments: paymentsQuery.data ?? [], reload: paymentsQuery.refetch, setError: feedback.setError };
}
