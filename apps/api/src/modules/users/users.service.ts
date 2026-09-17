import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { schema, type Database } from "@rentbrown/database";
import type { SupabaseIdentity } from "../../common/supabase/jwt-verifier.js";
import { DB } from "../../database/database.module.js";

const { users } = schema;

export type InternalUser = typeof users.$inferSelect;

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Just-in-time provisioning: map a verified Supabase identity to an internal
   * user row. First call creates the row; profile fields sync opportunistically.
   * Referral code derives from username and stays stable on username change.
   */
  async findOrProvision(identity: SupabaseIdentity): Promise<InternalUser> {
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.externalSubject, identity.subject))
      .limit(1);
    if (existing[0]) return existing[0];

    const username = this.deriveUsername(identity);
    const [created] = await this.db
      .insert(users)
      .values({
        externalSubject: identity.subject,
        email: identity.email ?? null,
        displayName: (identity.userMetadata.display_name as string) ?? null,
        username,
        referralCode: username ? await this.uniqueReferralCode(username) : null,
      })
      .returning();
    return created!;
  }

  private deriveUsername(identity: SupabaseIdentity): string | null {
    const meta = identity.userMetadata.username as string | undefined;
    if (meta && /^[a-zA-Z0-9_]{3,30}$/.test(meta)) return meta;
    return null;
  }

  private async uniqueReferralCode(base: string): Promise<string> {
    const cleaned =
      base
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 20) || "rb";
    for (let i = 0; i < 10; i++) {
      const suffix = i === 0 ? "" : `-${i}`;
      const candidate = `${cleaned}${suffix}`;
      const clash = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.referralCode, candidate))
        .limit(1);
      if (!clash[0]) return candidate;
    }
    // fall back to a random suffix — still deterministic per user thereafter
    return `${cleaned}-${Math.random().toString(36).slice(2, 7)}`;
  }

  async byId(id: string): Promise<InternalUser | undefined> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  }

  async permissionsFor(userId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ name: schema.permissions.name })
      .from(schema.userRoles)
      .innerJoin(schema.rolePermissions, eq(schema.userRoles.roleId, schema.rolePermissions.roleId))
      .innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
      .where(eq(schema.userRoles.userId, userId));
    return new Set(rows.map((r) => r.name));
  }
}
