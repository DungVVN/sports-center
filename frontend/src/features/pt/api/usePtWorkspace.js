import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ptApi } from "./pt-api.js";
import { hasSessionPermission } from "../../auth/index.js";
function performPtAction({ action, id, input }, canManage) {
  switch (action) {
    case "create":
      return ptApi.create(input);
    case "buy":
      return ptApi.buy(id);
    case "cancelPurchase":
      return ptApi.cancelPurchase(id);
    case "setPackageActive":
      return ptApi.setPackageActive(id, input);
    case "payment":
      return ptApi.payment(id, input);
    case "assign":
      return ptApi.assign(id, input);
    case "book":
      return ptApi.book(id, input);
    case "cancel":
      return ptApi.cancel(id, input, canManage);
    case "complete":
      return ptApi.complete(id, input);
    default:
      throw new Error("Thao tác PT không hợp lệ.");
  }
}
export function usePtWorkspace(session) {
  const client = useQueryClient();
  const canManage = hasSessionPermission(session, "pt.manage");
  const canPurchase =
    session.user.role === "member" &&
    hasSessionPermission(session, "pt.purchase");
  const canComplete = hasSessionPermission(session, "pt.complete");
  const packages = useQuery({
    queryKey: ["pt-packages"],
    queryFn: ptApi.packages,
  });
  const purchases = useQuery({
    queryKey: ["pt-purchases"],
    queryFn: ptApi.purchases,
    refetchInterval: 30_000,
  });
  const resources = useQuery({
    queryKey: ["pt-resources"],
    queryFn: ptApi.resources,
  });
  const mutation = useMutation({
    mutationFn: (operation) => performPtAction(operation, canManage),
    onSuccess: async () => {
      await Promise.all(
        [
          "pt-packages",
          "pt-purchases",
          "bookings",
          "classes",
          "payments",
          "member",
        ].map((key) =>
          client.invalidateQueries({
            queryKey: [key],
          }),
        ),
      );
    },
  });
  return {
    canManage,
    canPurchase,
    canComplete,
    packages,
    purchases,
    resources,
    mutation,
  };
}
