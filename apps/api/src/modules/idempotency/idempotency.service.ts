import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { and, eq, gt } from "drizzle-orm";
import { createHash } from "node:crypto";
import { schema, type Database } from "@rentbrown/database";
import { DB } from "../../database/database.module.js";

const { idempotencyKeys } = schema;

export interface StoredResponse {
  status: number;
  body: unknown;
}

export function hashRequest(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload ?? null))
    .digest("hex");
}

/**
 * Idempotency foundation — every future money-moving command runs through this.
 * Same (user, scope, key) + same request hash → replay stored response.
 * Same key + different payload → 409 CONFLICT, never re-execute.
 */
@Injectable()
export class IdempotencyService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async lookup(
    userId: string,
    scope: string,
    key: string,
    requestHash: string,
  ): Promise<StoredResponse | null> {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.userId, userId),
          eq(idempotencyKeys.scope, scope),
          eq(idempotencyKeys.key, key),
          gt(idempotencyKeys.expiresAt, now),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.requestHash && row.requestHash !== requestHash) {
      throw new ConflictException({
        code: "IDEMPOTENCY_CONFLICT",
        message: "Idempotency key reused with a different request",
      });
    }
    if (row.responseStatus == null) return null; // in-flight marker
    return { status: row.responseStatus, body: row.responseBody };
  }

  /** reserve the key before executing; returns false if already reserved */
  async reserve(
    userId: string,
    scope: string,
    key: string,
    requestHash: string,
    ttlMs = 86_400_000,
  ) {
    const inserted = await this.db
      .insert(idempotencyKeys)
      .values({
        userId,
        scope,
        key,
        requestHash,
        expiresAt: new Date(Date.now() + ttlMs),
      })
      .onConflictDoNothing()
      .returning();
    return inserted.length > 0;
  }

  async store(userId: string, scope: string, key: string, response: StoredResponse): Promise<void> {
    await this.db
      .update(idempotencyKeys)
      .set({ responseStatus: response.status, responseBody: response.body })
      .where(
        and(
          eq(idempotencyKeys.userId, userId),
          eq(idempotencyKeys.scope, scope),
          eq(idempotencyKeys.key, key),
        ),
      );
  }
}
