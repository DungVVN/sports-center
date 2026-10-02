import { z } from "zod";

export const auditEntityQuery = z.object({
  entityType: z.string().regex(/^[a-z][a-z_]{0,63}$/).optional(),
  entityId: z.string().uuid().optional(),
}).refine((value) => Boolean(value.entityType) === Boolean(value.entityId), {
  message: "Cần cung cấp đồng thời loại và mã đối tượng.",
});
