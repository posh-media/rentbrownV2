import { Inject, Injectable } from "@nestjs/common";
import { schema, type Database } from "@rentbrown/database";
import { requestContext } from "../../common/logging/json-logger.js";
import { DB } from "../../database/database.module.js";

const { auditEvents } = schema;

export interface AuditEntry {
  actorId?: string;
  actorType?: "USER" | "ADMIN" | "SYSTEM" | "PROVIDER";
  action: string;
  targetType?: string;
  targetId?: string;
  /** caller must pass already-redacted payloads — never raw PII or secrets */
  diffRedacted?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Audit foundation — append-only record of security-sensitive and financial
 * actions. Best-effort by default: a failed audit write logs an error but must
 * never block or roll back the operation it describes.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.db.insert(auditEvents).values({
        actorId: entry.actorId ?? null,
        actorType: entry.actorType ?? "USER",
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        requestId: requestContext.getStore()?.requestId ?? null,
        diffRedacted: entry.diffRedacted ?? null,
        metadata: entry.metadata ?? null,
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "audit write failed",
          action: entry.action,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
