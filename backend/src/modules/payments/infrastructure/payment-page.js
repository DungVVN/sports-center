import { Prisma } from "@prisma/client";
import { prisma } from "../../../database.js";

export async function selectPaymentPage(query) {
  const base = Prisma.sql`FROM payments p
    LEFT JOIN members m ON m.id = p.member_id
    LEFT JOIN member_memberships ms ON ms.id = p.membership_id
    LEFT JOIN course_enrollments ce ON ce.id = p.course_enrollment_id
    LEFT JOIN courses c ON c.id = ce.course_id
    LEFT JOIN pt_purchases pt ON pt.id = p.pt_purchase_id
    LEFT JOIN facility_reservations fr ON fr.id = p.facility_reservation_id
    LEFT JOIN facility_days fd ON fd.id = fr.day_id
    LEFT JOIN facilities f ON f.id = fd.facility_id`;
  const scope = query.memberId ? Prisma.sql`p.member_id = ${query.memberId}::uuid` : Prisma.sql`true`;
  const clauses = [scope];
  if (query.search) clauses.push(Prisma.sql`strpos(lower(concat_ws(' ', p.transaction_code, m.full_name, m.member_code, ms.package_name_snapshot, c.name, pt.package_name_snapshot, f.name)), lower(${query.search})) > 0`);
  for (const [column, values] of [[Prisma.sql`p.status::text`, query.status], [Prisma.sql`p.method::text`, query.method], [Prisma.sql`ms.package_name_snapshot`, query.package]]) {
    if (values?.length) clauses.push(Prisma.sql`${column} IN (${Prisma.join(values)})`);
  }
  const where = Prisma.join(clauses, " AND ");
  const sortColumns = { amountVnd: Prisma.sql`p.amount_vnd`, transaction_code: Prisma.sql`p.transaction_code`, updated_at: Prisma.sql`p.updated_at` };
  const sort = sortColumns[query.sort] ?? sortColumns.amountVnd;
  const direction = query.direction === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  return prisma.$transaction(async (tx) => {
    const [{ total }] = await tx.$queryRaw`SELECT count(*)::integer AS total ${base} WHERE ${where}`;
    const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)));
    const rows = await tx.$queryRaw`SELECT p.id ${base} WHERE ${where} ORDER BY ${sort} ${direction}, p.id DESC LIMIT ${query.pageSize} OFFSET ${(page - 1) * query.pageSize}`;
    const [facets] = await tx.$queryRaw`SELECT COALESCE(array_agg(DISTINCT ms.package_name_snapshot ORDER BY ms.package_name_snapshot) FILTER (WHERE ms.package_name_snapshot IS NOT NULL), ARRAY[]::text[]) AS package ${base} WHERE ${scope}`;
    return { ids: rows.map((row) => row.id), total, page, pageSize: query.pageSize, facets };
  }, { isolationLevel: "RepeatableRead" });
}
