import { Prisma } from "@prisma/client";
import { prisma } from "../../../database.js";

const base = Prisma.sql`WITH overview AS (
  SELECT m.id, m.created_at, m.full_name, m.member_code, m.email, m.phone,
    COALESCE(c.display_name, '__unassigned') AS coach,
    COALESCE(ms.package_name_snapshot, '__unregistered') AS package,
    COALESCE(ms.status::text, '__no_membership') AS status
  FROM members m
  LEFT JOIN LATERAL (
    SELECT package_name_snapshot, status FROM member_memberships
    WHERE member_id = m.id
    ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'expiring_soon' THEN 1 WHEN 'frozen' THEN 2
      WHEN 'pending_payment' THEN 3 WHEN 'expired' THEN 4 ELSE 5 END, created_at DESC, id DESC LIMIT 1
  ) ms ON true
  LEFT JOIN LATERAL (
    SELECT coach_user_id FROM member_coach_assignments
    WHERE member_id = m.id AND effective_from <= CURRENT_DATE AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
    ORDER BY effective_from DESC, id DESC LIMIT 1
  ) a ON true
  LEFT JOIN users c ON c.id = a.coach_user_id
)`;

export async function selectMemberPage(query) {
  const clauses = [Prisma.sql`true`];
  if (query.search) clauses.push(Prisma.sql`strpos(lower(concat_ws(' ', full_name, member_code, email, phone)), lower(${query.search})) > 0`);
  for (const [column, values] of [[Prisma.sql`coach`, query.coach], [Prisma.sql`package`, query.package], [Prisma.sql`status`, query.status]]) {
    if (values?.length) clauses.push(Prisma.sql`${column} IN (${Prisma.join(values)})`);
  }
  const where = Prisma.join(clauses, " AND ");
  return prisma.$transaction(async (tx) => {
    const [{ total }] = await tx.$queryRaw`${base} SELECT count(*)::integer AS total FROM overview WHERE ${where}`;
    const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)));
    const rows = await tx.$queryRaw`${base} SELECT id FROM overview WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${query.pageSize} OFFSET ${(page - 1) * query.pageSize}`;
    const [facets] = await tx.$queryRaw`${base} SELECT
      COALESCE(array_agg(DISTINCT coach ORDER BY coach), ARRAY[]::text[]) AS coach,
      COALESCE(array_agg(DISTINCT package ORDER BY package), ARRAY[]::text[]) AS package,
      COALESCE(array_agg(DISTINCT status ORDER BY status), ARRAY[]::text[]) AS status FROM overview`;
    return { ids: rows.map((row) => row.id), total, page, pageSize: query.pageSize, facets };
  }, { isolationLevel: "RepeatableRead" });
}
