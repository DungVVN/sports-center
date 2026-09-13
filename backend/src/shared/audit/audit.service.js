import { prisma } from "../../database.js";

export const auditService = {
  record({ actorUserId = null, action, entityType, entityId = null, summary, previousValue, newValue, reason }) {
    return prisma.audit_logs.create({ data: {
      actor_user_id: actorUserId, action, entity_type: entityType, entity_id: entityId,
      summary, previous_value: previousValue, new_value: newValue, reason,
    } });
  },
};
