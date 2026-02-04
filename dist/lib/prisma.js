"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("../generated/prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const globalForPrisma = globalThis;
function getConnectionString() {
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
    throw new Error("Set DATABASE_URL or (DB_HOST, DB_USERNAME, DB_PASSWORD) environment variables");
}
function createPrisma() {
    const connectionString = getConnectionString();
    const adapter = new adapter_pg_1.PrismaPg({ connectionString });
    return new client_1.PrismaClient({ adapter });
}
exports.prisma = globalForPrisma.prisma ?? createPrisma();
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = exports.prisma;
