import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { schema, type AccountStatusType, type Database } from "@rentbrown/database";
import type { UpdateProfileInput } from "@rentbrown/validation";
import type { SupabaseIdentity } from "../../common/supabase/jwt-verifier.js";
import { AppConfigService } from "../../config/config.service.js";
import { DB } from "../../database/database.module.js";
import { AuditService } from "../audit/audit.service.js";
import { POLICY } from "../policies/policies.keys.js";
import { PoliciesService } from "../policies/policies.service.js";
import { RolesService } from "../rbac/roles.service.js";

const { users } = schema;

export type InternalUser = typeof users.$inferSelect;

const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;

/** allowed account-status transitions; CLOSED is terminal */
const STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  ACTIVE: ["RESTRICTED", "SUSPENDED", "CLOSED"],
  RESTRICTED: ["ACTIVE", "SUSPENDED", "CLOSED"],
  SUSPENDED: ["ACTIVE", "RESTRICTED", "CLOSED"],
  CLOSED: [],
};

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === "23505";
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
    private readonly policies: PoliciesService,
    private readonly roles: RolesService,
  ) {}

  /**
   * Just-in-time provisioning: map a verified Supabase identity to an internal
   * user row. First call creates the row (investor role, currencies from
   * user_metadata, referral code); every call syncs email/verification/lastSeen.
   * accountCurrency is fixed here — deliberately NOT editable via updateProfile.
   */
  async findOrProvision(identity: SupabaseIdentity): Promise<InternalUser> {
    const existing = await this.byExternalSubject(identity.subject);
    if (existing) {
      await this.syncIdentity(existing, identity);
      return existing;
    }

    const username = this.deriveUsername(identity);
    const meta = identity.userMetadata;
    const bootstrapAdmin = this.isBootstrapAdmin(identity.email);
    try {
      // user row + role grants are atomic — a crash cannot leave a role-less
      // user. The audit write is deliberately outside (best-effort).
      const created = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(users)
          .values({
            externalSubject: identity.subject,
            email: identity.email ?? null,
            displayName: (meta.display_name as string) ?? null,
            username,
            referralCode: username ? await this.uniqueReferralCode(username, tx) : null,
            accountCurrency: meta.account_currency === "USD" ? "USD" : "NGN",
            displayCurrency: meta.display_currency === "USD" ? "USD" : "NGN",
            emailVerifiedAt: identity.emailVerified ? new Date() : null,
            lastSeenAt: new Date(),
          })
          .returning();
        await this.roles.grantSystem(row!.id, "investor", undefined, tx as Database);
        if (bootstrapAdmin) {
          await this.roles.grantSystem(row!.id, "super_admin", undefined, tx as Database);
        }
        return row!;
      });

      if (bootstrapAdmin) {
        await this.audit.record({
          actorType: "SYSTEM",
          action: "rbac.bootstrap_super_admin",
          targetType: "user",
          targetId: created.id,
        });
      }
      return created;
    } catch (err) {
      // two concurrent first requests — loser re-selects the winner's row
      if (isUniqueViolation(err)) {
        const winner = await this.byExternalSubject(identity.subject);
        if (winner) return winner;
      }
      throw err;
    }
  }

  /** cheap identity sync — single UPDATE only when something changed */
  private async syncIdentity(user: InternalUser, identity: SupabaseIdentity) {
    const patch: Partial<typeof users.$inferInsert> = {};
    if (identity.email && identity.email !== user.email) patch.email = identity.email;
    if (identity.emailVerified && !user.emailVerifiedAt) patch.emailVerifiedAt = new Date();
    const stale = !user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > LAST_SEEN_REFRESH_MS;
    if (stale) patch.lastSeenAt = new Date();
    if (Object.keys(patch).length === 0) return;
    try {
      await this.db.update(users).set(patch).where(eq(users.id, user.id));
    } catch (err) {
      // the Supabase email may already belong to another internal user —
      // drop it and apply the rest rather than 500ing every request
      if (isUniqueViolation(err) && patch.email) {
        console.warn(
          JSON.stringify({ level: "warn", msg: "identity.email_sync_conflict", userId: user.id }),
        );
        delete patch.email;
        if (Object.keys(patch).length === 0) return;
        await this.db.update(users).set(patch).where(eq(users.id, user.id));
      } else {
        throw err;
      }
    }
    Object.assign(user, patch);
  }

  private isBootstrapAdmin(email?: string): boolean {
    if (!email) return false;
    const list = (this.config.get("BOOTSTRAP_SUPER_ADMIN_EMAILS") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return list.includes(email.toLowerCase());
  }

  private deriveUsername(identity: SupabaseIdentity): string | null {
    const meta = identity.userMetadata.username as string | undefined;
    if (meta && /^[a-zA-Z0-9_]{3,30}$/.test(meta)) return meta;
    return null;
  }

  private async uniqueReferralCode(base: string, tx?: Database): Promise<string> {
    const db = tx ?? this.db;
    const cleaned =
      base
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 20) || "rb";
    for (let i = 0; i < 10; i++) {
      const suffix = i === 0 ? "" : `-${i}`;
      const candidate = `${cleaned}${suffix}`;
      const clash = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.referralCode, candidate))
        .limit(1);
      if (!clash[0]) return candidate;
    }
    // fall back to a random suffix — still deterministic per user thereafter
    return `${cleaned}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * Self-service profile update. accountCurrency is intentionally absent from
   * the schema — it is fixed at provisioning. Every update is audited with
   * the changed field names only (values may contain PII).
   */
  async updateProfile(userId: string, patch: UpdateProfileInput): Promise<InternalUser> {
    const user = await this.requireUser(userId);
    const set: Partial<typeof users.$inferInsert> = {};
    const changed: string[] = [];

    const apply = <K extends keyof typeof set>(field: string, key: K, value: (typeof set)[K]) => {
      set[key] = value;
      changed.push(field);
    };

    if (patch.displayName !== undefined) apply("displayName", "displayName", patch.displayName);
    if (patch.firstName !== undefined) apply("firstName", "firstName", patch.firstName);
    if (patch.lastName !== undefined) apply("lastName", "lastName", patch.lastName);
    if (patch.displayCurrency !== undefined)
      apply("displayCurrency", "displayCurrency", patch.displayCurrency);
    if (patch.notificationPrefs !== undefined) {
      apply("notificationPrefs", "notificationPrefs", {
        ...((user.notificationPrefs as Record<string, boolean>) ?? {}),
        ...patch.notificationPrefs,
      });
    }
    if (patch.timezone !== undefined) {
      if (!Intl.supportedValuesOf("timeZone").includes(patch.timezone)) {
        throw new BadRequestException({
          code: "INVALID_TIMEZONE",
          message: "Unrecognized IANA timezone",
        });
      }
      apply("timezone", "timezone", patch.timezone);
    }
    if (patch.username !== undefined && patch.username !== user.username) {
      const allowed = await this.policies.get(POLICY.usernameChangeAllowed);
      if (!allowed) {
        throw new ForbiddenException({
          code: "USERNAME_CHANGE_DISABLED",
          message: "Username changes are currently disabled",
        });
      }
      apply("username", "username", patch.username);
    }

    if (changed.length === 0) return user;
    set.updatedAt = new Date();

    let updated: InternalUser | undefined;
    try {
      [updated] = await this.db.update(users).set(set).where(eq(users.id, userId)).returning();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({
          code: "USERNAME_TAKEN",
          message: "That username is already in use",
        });
      }
      throw err;
    }

    await this.audit.record({
      actorId: userId,
      actorType: "USER",
      action: "user.profile_updated",
      targetType: "user",
      targetId: userId,
      diffRedacted: changed,
    });
    return updated!;
  }

  /** admin status transition — CLOSED is terminal and soft-deletes the row */
  async setAccountStatus(
    targetUserId: string,
    next: AccountStatusType,
    reason: string,
    actorId: string,
  ): Promise<InternalUser> {
    if (targetUserId === actorId) {
      throw new ForbiddenException({
        code: "SELF_ACTION_FORBIDDEN",
        message: "Cannot change your own account status",
      });
    }
    const user = await this.requireUser(targetUserId);
    const from = user.accountStatus;
    if (!STATUS_TRANSITIONS[from]?.includes(next)) {
      throw new ConflictException({
        code: "INVALID_STATUS_TRANSITION",
        message: `Cannot transition from ${from} to ${next}`,
      });
    }
    const [updated] = await this.db
      .update(users)
      .set({
        accountStatus: next,
        statusChangedAt: new Date(),
        statusReason: reason,
        deletedAt: next === "CLOSED" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId))
      .returning();

    await this.audit.record({
      actorId,
      actorType: "ADMIN",
      action: "user.status_changed",
      targetType: "user",
      targetId: targetUserId,
      diffRedacted: { from, to: next },
    });
    return updated!;
  }

  async byId(id: string): Promise<InternalUser | undefined> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  }

  async byExternalSubject(subject: string): Promise<InternalUser | undefined> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.externalSubject, subject))
      .limit(1);
    return rows[0];
  }

  async permissionsFor(userId: string): Promise<Set<string>> {
    return this.roles.permissionsFor(userId);
  }

  private async requireUser(id: string): Promise<InternalUser> {
    const user = await this.byId(id);
    if (!user) {
      throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" });
    }
    return user;
  }
}
