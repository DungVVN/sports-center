export function createAuditLogService({ repository }) {
  return {
    list: (pagination) => repository.list(pagination),
  };
}
