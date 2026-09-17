import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { ZodSchema } from "zod";
import { schema, type Database } from "@rentbrown/database";
import { DB } from "../../database/database.module.js";
import { AuditService } from "../audit/audit.service.js";
import type { PolicySpec } from "./policies.keys.js";

const { systemPolicies } = schema;
// Per-process cache: on multi-instance deploys a `set` leaves other instances
// stale for up to this TTL — acceptable for Phase 2. Policies affecting money
// must be read inside the transaction in later phases, not via this cache.
const CACHE_TTL_MS = 30_000;

/**
 * System policies — runtime-tunable configuration stored in system_policies.
 * Reads are cached per key for 30s and always validated against the caller's
 * zod schema; a missing/invalid row or a DB error yields the fallback and a
 * structured log (never values — policies may become sensitive).
 */
@Injectable()
export class PoliciesService {
  private readonly cache = new Map<string, { value: unknown; expiresAt: number }>();

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async get<T>(spec: PolicySpec<T>): Promise<T>;
  async get<T>(key: string, schema: ZodSchema<T>, fallback: T): Promise<T>;
  async get<T>(specOrKey: PolicySpec<T> | string, schema?: ZodSchema<T>, fallback?: T): Promise<T> {
    const spec: PolicySpec<T> =
      typeof specOrKey === "string"
        ? { key: specOrKey, schema: schema!, fallback: fallback as T }
        : specOrKey;

    const cached = this.cache.get(spec.key);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;

    let value: T = spec.fallback;
    try {
      const rows = await this.db
        .select({ value: systemPolicies.value })
        .from(systemPolicies)
        .where(eq(systemPolicies.key, spec.key))
        .limit(1);
      if (rows[0] !== undefined) {
        const parsed = spec.schema.safeParse(rows[0].value);
        if (parsed.success) {
          value = parsed.data;
        } else {
          this.logInvalid(spec.key, "stored value failed schema validation");
        }
      }
    } catch (err) {
      this.logInvalid(spec.key, err instanceof Error ? err.message : String(err));
    }
    this.cache.set(spec.key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  /** value + the row's optimistic version — used to stamp policy_version */
  async getWithVersion<T>(spec: PolicySpec<T>): Promise<{ value: T; version: number }> {
    const value = await this.get(spec);
    try {
      const rows = await this.db
        .select({ version: systemPolicies.version })
        .from(systemPolicies)
        .where(eq(systemPolicies.key, spec.key))
        .limit(1);
      return { value, version: rows[0]?.version ?? 0 };
    } catch {
      return { value, version: 0 };
    }
  }

  /** upsert a policy — bumps version, stamps actor, invalidates cache, audits */
  async set(key: string, value: unknown, actorId: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(systemPolicies)
      .where(eq(systemPolicies.key, key))
      .limit(1);
    const fromVersion = existing[0]?.version ?? 0;
    const toVersion = fromVersion + 1;

    if (existing[0]) {
      await this.db
        .update(systemPolicies)
        .set({ value, version: toVersion, updatedBy: actorId, updatedAt: new Date() })
        .where(eq(systemPolicies.key, key));
    } else {
      await this.db.insert(systemPolicies).values({ key, value, updatedBy: actorId });
    }
    this.cache.delete(key);

    await this.audit.record({
      actorId,
      actorType: "ADMIN",
      action: "policy.updated",
      targetType: "system_policy",
      targetId: key,
      diffRedacted: { key, fromVersion, toVersion },
    });
  }

  async list() {
    return this.db.select().from(systemPolicies);
  }

  private logInvalid(key: string, reason: string) {
    console.error(
      JSON.stringify({ level: "error", msg: "policy read failed — using fallback", key, reason }),
    );
  }
}
