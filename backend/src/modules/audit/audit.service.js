export function createAuditLogService({ repository }) { return { list: () => repository.list() }; }
