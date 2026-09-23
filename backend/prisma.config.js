import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "database/prisma/schema.prisma",
  datasource: {
    // Migrations use a DB-owner URL; runtime uses a restricted URL.
    url: process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL,
  },
});
