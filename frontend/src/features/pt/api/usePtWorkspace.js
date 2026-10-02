import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ptApi } from "./pt-api.js";
import { hasSessionPermission } from "../../auth/index.js";
export function usePtWorkspace(session) {
  const client = useQueryClient();
  const canManage = hasSessionPermission(session, "pt.manage");
  const canPurchase = session.user.role === "member" && hasSessionPermission(session, "pt.purchase");
  const canComplete = hasSessionPermission(session, "pt.complete");
  const packages = useQuery({ queryKey: ["pt-packages"], queryFn: ptApi.packages });
  const purchases = useQuery({ queryKey: ["pt-purchases"], queryFn: ptApi.purchases, refetchInterval: 30_000 });
  const resources = useQuery({ queryKey: ["pt-resources"], queryFn: ptApi.resources });
  const mutation = useMutation({
    mutationFn: ({ action, id, input }) => action === "cancel" ? ptApi.cancel(id, input, canManage) : ptApi[action](...(action === "create" ? [input] : [id, input])),
    onSuccess: async () => {
      await Promise.all(["pt-packages", "pt-purchases", "bookings", "classes", "payments", "member"].map((key) => client.invalidateQueries({ queryKey: [key] })));
    },
  });
  return { canManage, canPurchase, canComplete, packages, purchases, resources, mutation };
}
