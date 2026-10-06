import { isDeepStrictEqual } from "node:util";

const identifier = (value) => `"${value.replaceAll('"', '""')}"`;

export async function readBusinessManifest(client) {
  const { rows: tables } = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY table_name");
  if (!tables.some((table) => table.table_name === "members") || !tables.some((table) => table.table_name === "payments")) {
    throw new Error("Restore verification requires the Sports Center business schema.");
  }
  const manifest = {};
  for (const { table_name: table } of tables) {
    // Order-independent row fingerprints keep memory bounded and contain no
    // personal data. Both halves are compared along with the exact row count.
    const { rows: [result] } = await client.query(`SELECT count(*)::text AS rows,
      COALESCE(sum(('x' || substr(digest, 1, 16))::bit(64)::bigint::numeric), 0)::text AS digest1,
      COALESCE(sum(('x' || substr(digest, 17, 16))::bit(64)::bigint::numeric), 0)::text AS digest2
      FROM (SELECT md5(to_jsonb(t)::text) AS digest FROM public.${identifier(table)} t) fingerprints`);
    manifest[table] = result;
  }
  return manifest;
}

export function verifyBusinessManifest(expected, restored) {
  if (!isDeepStrictEqual(expected, restored)) throw new Error("Restored business data does not match the source snapshot.");
}
