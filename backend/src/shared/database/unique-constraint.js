/**
 * Normalizes Prisma's P2002 error metadata so services can return an
 * actionable conflict response instead of leaking a database error as 500.
 */
export function uniqueConstraintFields(error) {
  if (error?.code !== "P2002") return [];

  const target = error.meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return target.split(/[\s,.]+/).filter(Boolean);
  return [];
}

export function violatesUniqueConstraint(error, fields = []) {
  if (error?.code !== "P2002") return false;
  if (!fields.length) return true;

  const targets = uniqueConstraintFields(error).map((field) => field.toLowerCase());
  return targets.some((target) => fields.some((field) => target.includes(field.toLowerCase())));
}

export async function retryOnUniqueConstraint(operation, { fields, attempts = 3 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!violatesUniqueConstraint(error, fields) || attempt === attempts - 1) throw error;
    }
  }
}
