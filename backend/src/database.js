import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseConnectionString } from "./database-url.js";
import { currentRuntime } from "./shared/runtime/request-context.js";
import { DatabasePool } from "./database-pool.js";

export function createDatabaseClient(configuredConnectionString, { max = 10 } = {}) {
  if (!configuredConnectionString) throw new Error("DATABASE_URL is required to initialize the Sports Center database client.");
  const connectionString = normalizeDatabaseConnectionString(configuredConnectionString);
  const schemaMatch = connectionString.match(/[?&]schema=([^&]+)/);
  const schema = schemaMatch ? decodeURIComponent(schemaMatch[1]) : undefined;
  // Prisma's PG adapter serializes timestamps in UTC. Pin each connection so
  // a restored database's session timezone cannot shift stored service hours.
  const options = `-c timezone=UTC${schema ? ` -c search_path="${schema}",public` : ""}`;
  const pool = new DatabasePool({
    connectionString, options, max,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 60_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  const adapter = new PrismaPg(pool, { ...(schema ? { schema } : {}), disposeExternalPool: true });
  return new PrismaClient({ adapter });
}

let nodeClient;
// Workers clients belong to one request; the Node server retains its shared pool.
export const prisma = new Proxy({}, {
  get(_target, property) {
    const client = currentRuntime()?.database ?? (nodeClient ??= createDatabaseClient(process.env.DATABASE_URL));
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
