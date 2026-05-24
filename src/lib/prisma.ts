import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | null;
};

let prismaInstance: PrismaClient | null = null;

try {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

  if (connectionString) {
    // Always create a connection pool for the adapter
    const pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    const adapter = new PrismaPg(pool);

    prismaInstance = new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  } else {
    console.warn(
      "DATABASE_URL or DIRECT_URL not set. PrismaClient will not be initialized.",
    );
  }
} catch (error) {
  console.error("Failed to initialize Prisma:", error);
  prismaInstance = null;
}

export const prisma =
  (globalForPrisma.prisma as PrismaClient) || prismaInstance;

if (process.env.NODE_ENV !== "production" && prismaInstance) {
  globalForPrisma.prisma = prismaInstance;
}
