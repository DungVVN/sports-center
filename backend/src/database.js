import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseConnectionString } from "./database-url.js";

const configuredConnectionString = process.env.DATABASE_URL;

if (!configuredConnectionString) {
  throw new Error("DATABASE_URL is required to initialize the Sports Center database client.");
}

const connectionString = normalizeDatabaseConnectionString(configuredConnectionString);
const schemaMatch = connectionString.match(/[?&]schema=([^&]+)/);
const schema = schemaMatch ? decodeURIComponent(schemaMatch[1]) : undefined;
const options = schema ? `-c search_path="${schema}",public` : undefined;
const adapter = new PrismaPg({ connectionString, options }, schema ? { schema } : undefined);

export const prisma = new PrismaClient({ adapter });
