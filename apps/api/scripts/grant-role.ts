/**
 * CLI: grant a role to a user by email.
 *
 *   pnpm --filter @rentbrown/api grant-role -- <email> <role>
 *
 * Primary way to create the first super_admin (BOOTSTRAP_SUPER_ADMIN_EMAILS
 * is the provisioning-time alternative). Writes an audit event with
 * actorType SYSTEM and metadata.source = "cli".
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { createDb, createPool, ROLE_NAMES, schema, type RoleName } from "@rentbrown/database";

const { users, roles, userRoles, auditEvents } = schema;

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const name of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), "../../", name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      const m = line.match(/^DATABASE_URL=(.*)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("DATABASE_URL is not set and no root .env/.env.local defines it");
}

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role || !(ROLE_NAMES as readonly string[]).includes(role)) {
    console.error(`usage: grant-role <email> <role>\n  roles: ${ROLE_NAMES.join(", ")}`);
    process.exit(1);
  }

  const pool = createPool(loadDatabaseUrl());
  const db = createDb(pool);
  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) throw new Error(`no user with email ${email}`);
    const [roleRow] = await db.select().from(roles).where(eq(roles.name, role)).limit(1);
    if (!roleRow) throw new Error(`role ${role} does not exist — run migrations first`);

    await db
      .insert(userRoles)
      .values({ userId: user.id, roleId: roleRow.id })
      .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] });

    const granted = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(and(eq(userRoles.userId, user.id), eq(userRoles.roleId, roleRow.id)))
      .limit(1);

    await db.insert(auditEvents).values({
      actorType: "SYSTEM",
      action: "rbac.role_assigned",
      targetType: "user",
      targetId: user.id,
      diffRedacted: { role: role as RoleName },
      metadata: { source: "cli" },
    });

    console.log(`${granted.length ? "granted" : "failed"}: ${email} → ${role}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
