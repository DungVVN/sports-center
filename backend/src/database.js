import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to initialize the Sports Center database client.");
}

const schemaMatch = connectionString.match(/[?&]schema=([^&]+)/);
const schema = schemaMatch ? decodeURIComponent(schemaMatch[1]) : undefined;
const options = schema ? `-c search_path="${schema}",public` : undefined;
const adapter = new PrismaPg({ connectionString, options }, schema ? { schema } : undefined);

export const prisma = new PrismaClient({ adapter });
