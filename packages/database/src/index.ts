import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

export * as schema from "./schema/index.js";
export * from "./rbac.js";
export type { AccountStatusType } from "./schema/index.js";
export type Database = NodePgDatabase<typeof schema>;

export function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function createDb(poolOrUrl: Pool | string): Database {
  const pool = typeof poolOrUrl === "string" ? createPool(poolOrUrl) : poolOrUrl;
  return drizzle(pool, { schema });
}
