import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseConnectionString } from "./database-url.js";
import { currentRuntime } from "./shared/runtime/request-context.js";

export function createDatabaseClient(configuredConnectionString, { max = 10 } = {}) {
  if (!configuredConnectionString) throw new Error("DATABASE_URL is required to initialize the Sports Center database client.");
  const connectionString = normalizeDatabaseConnectionString(configuredConnectionString);
  const schemaMatch = connectionString.match(/[?&]schema=([^&]+)/);
  const schema = schemaMatch ? decodeURIComponent(schemaMatch[1]) : undefined;
  const options = schema ? `-c search_path="${schema}",public` : undefined;
  const adapter = new PrismaPg({ connectionString, options, max }, schema ? { schema } : undefined);
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
