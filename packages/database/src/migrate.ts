/**
 * Migration runner — applies drizzle-kit generated SQL migrations.
 * Usage: DATABASE_URL=... pnpm --filter @rentbrown/database migrate
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, "../drizzle");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: url, max: 1 });
const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder });
  console.log("Migrations applied.");
} finally {
  await pool.end();
}
