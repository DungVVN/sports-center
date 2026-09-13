import { prisma } from "../../database.js";
export const auditRepository = { list: () => prisma.audit_logs.findMany({ orderBy: { occurred_at: "desc" }, take: 200 }) };
