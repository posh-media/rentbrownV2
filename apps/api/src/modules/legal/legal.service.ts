import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@rentbrown/database";
import type { ConsentDto, LegalDocumentDto, PlatformName } from "@rentbrown/types";
import { DB } from "../../database/database.module.js";
import { AuditService } from "../audit/audit.service.js";

const { termsVersions, userConsents } = schema;

export interface ConsentContext {
  ip?: string;
  userAgent?: string;
  platform?: PlatformName;
}

function toDocumentDto(row: typeof termsVersions.$inferSelect): LegalDocumentDto {
  return {
    id: row.id,
    docType: row.docType,
    version: row.version,
    title: row.title,
    summary: row.summary,
    contentUrl: row.contentUrl,
    effectiveAt: row.effectiveAt?.toISOString() ?? null,
    publishedAt: row.publishedAt.toISOString(),
  };
}

function toConsentDto(row: typeof userConsents.$inferSelect): ConsentDto {
  return {
    id: row.id,
    termsVersionId: row.termsVersionId,
    docType: row.docType,
    version: row.version,
    acceptedAt: row.acceptedAt.toISOString(),
    platform: row.platform,
  };
}

/**
 * Legal documents and consent records. A user must consent to each doc_type's
 * CURRENT version; consent rows snapshot docType/version so audits never need
 * to join back to terms_versions.
 */
@Injectable()
export class LegalService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async currentDocuments(): Promise<LegalDocumentDto[]> {
    const rows = await this.db
      .select()
      .from(termsVersions)
      .where(eq(termsVersions.isCurrent, true));
    return rows.map(toDocumentDto);
  }

  /** doc types whose current version the user has not consented to */
  async pendingFor(userId: string): Promise<string[]> {
    const current = await this.db
      .select()
      .from(termsVersions)
      .where(eq(termsVersions.isCurrent, true));
    if (current.length === 0) return [];
    const consents = await this.db
      .select({ termsVersionId: userConsents.termsVersionId })
      .from(userConsents)
      .where(eq(userConsents.userId, userId));
    const consented = new Set(consents.map((c) => c.termsVersionId));
    return current.filter((d) => !consented.has(d.id)).map((d) => d.docType);
  }

  async consentsFor(userId: string): Promise<ConsentDto[]> {
    const rows = await this.db.select().from(userConsents).where(eq(userConsents.userId, userId));
    return rows.map(toConsentDto);
  }

  async recordConsent(
    userId: string,
    termsVersionId: string,
    ctx: ConsentContext,
  ): Promise<ConsentDto> {
    const [doc] = await this.db
      .select()
      .from(termsVersions)
      .where(eq(termsVersions.id, termsVersionId))
      .limit(1);
    if (!doc) {
      throw new NotFoundException({ code: "TERMS_NOT_FOUND", message: "Unknown document" });
    }
    if (!doc.isCurrent) {
      throw new ConflictException({
        code: "TERMS_VERSION_NOT_CURRENT",
        message: "Only the current version of a document can be accepted",
      });
    }

    const values = {
      userId,
      termsVersionId,
      docType: doc.docType,
      version: doc.version,
      ipAddress: ctx.ip ?? null,
      userAgentHash: ctx.userAgent
        ? createHash("sha256").update(ctx.userAgent).digest("hex")
        : null,
      platform: ctx.platform ?? null,
    };
    const [row] = await this.db
      .insert(userConsents)
      .values(values)
      .onConflictDoNothing({ target: [userConsents.userId, userConsents.termsVersionId] })
      .returning();

    if (!row) {
      const [existing] = await this.db
        .select()
        .from(userConsents)
        .where(
          and(eq(userConsents.userId, userId), eq(userConsents.termsVersionId, termsVersionId)),
        )
        .limit(1);
      return toConsentDto(existing!);
    }

    await this.audit.record({
      actorId: userId,
      actorType: "USER",
      action: "legal.consent_recorded",
      targetType: "terms_version",
      targetId: termsVersionId,
      diffRedacted: { docType: doc.docType, version: doc.version },
    });
    return toConsentDto(row);
  }
}
