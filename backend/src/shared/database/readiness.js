import { prisma } from "../../database.js";

export async function checkDatabaseReadiness() {
  await prisma.$queryRaw`SELECT 1`;
}
