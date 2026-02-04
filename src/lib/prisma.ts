import type { PoolConfig } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getConnectionString(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT ?? "5432";
  const user = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const db = process.env.DB_NAME ?? "snippet_manager";
  if (host && user && password) {
    const encoded = encodeURIComponent(password);
    return `postgresql://${user}:${encoded}@${host}:${port}/${db}?schema=public`;
  }
  throw new Error(
    "Set DATABASE_URL or (DB_HOST, DB_USERNAME, DB_PASSWORD) environment variables",
  );
}

/** Strip sslmode from URL so pg doesn't override our explicit ssl config. */
function connectionStringWithoutSslMode(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    return u.toString();
  } catch {
    return url.replace(/[?&]sslmode=[^&]+/g, "").replace(/[?&]ssl=[^&]+/g, "");
  }
}

function createPrisma() {
  let connectionString = getConnectionString();
  const isRds = Boolean(process.env.DB_HOST);
  // RDS: use TLS but don't verify cert (Node rejects RDS cert). Strip sslmode from URL
  // so pg-connection-string parse() doesn't override our ssl config.
  if (isRds) {
    connectionString = connectionStringWithoutSslMode(connectionString);
  }
  const poolConfig: PoolConfig = {
    connectionString,
    ...(isRds && { ssl: { rejectUnauthorized: false } }),
  };
  const adapter = new PrismaPg(poolConfig);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
