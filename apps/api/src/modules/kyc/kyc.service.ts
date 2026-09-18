import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { kycMachine, type KycState } from "@rentbrown/domain";
import type { KycDecision, KycProvider } from "@rentbrown/providers";
import { schema, type Database } from "@rentbrown/database";
import { kycIdNumberSchemaFor, type AdminKycQuery } from "@rentbrown/validation";
import type {
  AdminKycCaseDto,
  KycCaseDto,
  KycCheckDto,
  KycDecisionDto,
  KycDocumentDto,
  KycSummaryDto,
  Paginated,
} from "@rentbrown/types";
import { AppConfigService } from "../../config/config.service.js";
import { DB } from "../../database/database.module.js";
import { AuditService } from "../audit/audit.service.js";
import { LegalService } from "../legal/legal.service.js";
import { POLICY } from "../policies/policies.keys.js";
import { PoliciesService } from "../policies/policies.service.js";
import { RolesService } from "../rbac/roles.service.js";
import { KYC_PROVIDER, STORAGE_PROVIDER } from "../storage/storage.provider.js";
import type { StorageProvider } from "@rentbrown/providers";
import { KycNotConfiguredError } from "./providers/smile-identity.provider.js";
import type { InternalUser } from "../users/users.service.js";

const { kycCases, kycChecks, kycDecisions, kycDocuments, users, webhookEvents } = schema;

const OPEN_STATUSES: KycState[] = ["DRAFT", "SUBMITTED", "IN_REVIEW", "MORE_INFO_REQUIRED"];
const MAX_DOCUMENTS_PER_CASE = 6;
const SIGNED_URL_TTL_S = 60;
const WEBHOOK_PROVIDER = "SMILE_IDENTITY";

const MAGIC: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
};

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === "23505";
}

type Case = typeof kycCases.$inferSelect;
type Check = typeof kycChecks.$inferSelect;

@Injectable()
export class KycService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
    private readonly policies: PoliciesService,
    private readonly legal: LegalService,
    private readonly roles: RolesService,
    @Inject(KYC_PROVIDER) private readonly provider: KycProvider,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  // ── Summary ─────────────────────────────────────────────────
  async summaryFor(userId: string): Promise<KycSummaryDto> {
    const [user] = await this.db
      .select({ accountStatus: users.accountStatus })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const [cases, allowedIdTypes] = await Promise.all([
      this.db
        .select()
        .from(kycCases)
        .where(eq(kycCases.userId, userId))
        .orderBy(desc(kycCases.createdAt)),
      this.policies.get(POLICY.kycAllowedIdTypes),
    ]);

    const approvedTier = cases
      .filter((c) => c.status === "APPROVED")
      .reduce((m, c) => Math.max(m, c.currentTier), 0);
    const open = cases.find((c) => OPEN_STATUSES.includes(c.status));
    const latest = open ?? cases[0];

    const canStart = !open && user?.accountStatus === "ACTIVE";
    const nextSteps: string[] = !latest
      ? ["START_KYC"]
      : latest.status === "DRAFT"
        ? ["SUBMIT_ID_VERIFICATION"]
        : latest.status === "MORE_INFO_REQUIRED"
          ? ["PROVIDE_MORE_INFO"]
          : latest.status === "SUBMITTED" || latest.status === "IN_REVIEW"
            ? ["AWAIT_REVIEW"]
            : canStart
              ? ["START_KYC"]
              : [];

    return {
      status: latest ? latest.status : "NONE",
      tier: approvedTier,
      caseId: open?.id,
      requestedTier: latest?.requestedTier,
      updatedAt: latest?.updatedAt.toISOString(),
      canStart,
      nextSteps,
      allowedIdTypes,
    };
  }

  // ── Case lifecycle ──────────────────────────────────────────
  async startCase(user: InternalUser, requestedTier: number): Promise<KycCaseDto> {
    const { value: tiers, version } = await this.policies.getWithVersion(POLICY.kycTiers);
    if (!tiers[String(requestedTier)]) {
      throw new BadRequestException({
        code: "KYC_UNKNOWN_TIER",
        message: "Unknown KYC tier",
      });
    }
    if (user.accountStatus !== "ACTIVE") {
      throw new ForbiddenException({
        code: "ACCOUNT_NOT_ACTIVE",
        message: "KYC requires an active account",
      });
    }
    let row: Case | undefined;
    try {
      [row] = await this.db
        .insert(kycCases)
        .values({
          userId: user.id,
          requestedTier,
          status: "DRAFT",
          policyVersion: `kyc.tiers@${version}`,
        })
        .returning();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({
          code: "KYC_CASE_ALREADY_OPEN",
          message: "An open KYC case already exists",
        });
      }
      throw err;
    }
    await this.audit.record({
      actorId: user.id,
      action: "kyc.case_started",
      targetType: "kyc_case",
      targetId: row!.id,
      metadata: { requestedTier },
    });
    return this.caseView(row!, []);
  }

  async submitIdVerification(
    user: InternalUser,
    caseId: string,
    input: {
      country: string;
      idType: string;
      idNumber: string;
      firstName: string;
      lastName: string;
      dob?: string;
    },
  ): Promise<KycCaseDto> {
    const kase = await this.ownedCase(user.id, caseId);
    if (kase.status !== "DRAFT" && kase.status !== "MORE_INFO_REQUIRED") {
      throw new ConflictException({
        code: "KYC_INVALID_STATE",
        message: `Cannot submit a check while the case is ${kase.status}`,
      });
    }

    const allowed = await this.policies.get(POLICY.kycAllowedIdTypes);
    if (!allowed[input.country]?.includes(input.idType)) {
      throw new BadRequestException({
        code: "KYC_ID_TYPE_NOT_ALLOWED",
        message: "ID type is not accepted for this country",
      });
    }
    if (!kycIdNumberSchemaFor(input.country, input.idType).safeParse(input.idNumber).success) {
      throw new BadRequestException({
        code: "INVALID_ID_NUMBER",
        message: "ID number format is invalid",
      });
    }

    const pending = await this.legal.pendingFor(user.id);
    if (pending.length > 0) {
      throw new ConflictException({
        code: "CONSENT_REQUIRED",
        message: "Current legal documents must be accepted before KYC submission",
      });
    }

    // only a hash + last4 ever touch the database — never the full number
    const idNumberHash = createHash("sha256").update(`${input.idNumber}:${user.id}`).digest("hex");
    const [check] = await this.db
      .insert(kycChecks)
      .values({
        caseId: kase.id,
        checkType: "ID_VERIFICATION",
        status: "PENDING",
        idType: input.idType,
        country: input.country,
        idNumberLast4: input.idNumber.slice(-4),
        idNumberHash,
      })
      .returning();

    let handle;
    try {
      handle = await this.provider.submitCheck({
        userId: user.id,
        caseId: kase.id,
        checkId: check!.id,
        checkType: "ID_VERIFICATION",
        country: input.country,
        idType: input.idType,
        idNumber: input.idNumber,
        person: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: user.email ?? undefined,
          dob: input.dob,
        },
        consent: {
          grantedAt: new Date(),
          privacyPolicyUrl: `${this.config.get("API_PUBLIC_URL")}/v1/legal/documents`,
        },
        callbackUrl: this.config.get("SMILE_IDENTITY_CALLBACK_URL"),
      });
    } catch (err) {
      const code =
        err instanceof KycNotConfiguredError
          ? "KYC_PROVIDER_NOT_CONFIGURED"
          : ((err as { code?: string }).code ?? "PROVIDER_UNAVAILABLE");
      await this.db
        .update(kycChecks)
        .set({ status: "FAILED", providerMessage: code, updatedAt: new Date() })
        .where(eq(kycChecks.id, check!.id));
      if (err instanceof KycNotConfiguredError) {
        throw new ServiceUnavailableException({
          code: "KYC_PROVIDER_NOT_CONFIGURED",
          message: "Identity verification is not configured",
        });
      }
      throw new BadGatewayException({
        code: "KYC_PROVIDER_ERROR",
        message: "Identity verification provider error",
      });
    }

    // case state via the domain machine — provider submission moves to SUBMITTED
    const from = kase.status;
    kycMachine.assertTransition(from, "SUBMITTED");
    await this.db.transaction(async (tx) => {
      await tx
        .update(kycChecks)
        .set({ providerJobId: handle.providerJobId, updatedAt: new Date() })
        .where(eq(kycChecks.id, check!.id));
      await tx
        .update(kycCases)
        .set({
          status: "SUBMITTED",
          submittedAt: new Date(),
          providerUserId: handle.providerUserId ?? null,
          lastProviderSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(kycCases.id, kase.id));
    });

    // opportunistic profile fill — audited as a profile update
    const namePatch: Record<string, string> = {};
    if (!user.firstName) namePatch.firstName = input.firstName;
    if (!user.lastName) namePatch.lastName = input.lastName;
    if (Object.keys(namePatch).length > 0) {
      await this.db
        .update(users)
        .set({ ...namePatch, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      await this.audit.record({
        actorId: user.id,
        action: "user.profile_updated",
        targetType: "user",
        targetId: user.id,
        diffRedacted: Object.keys(namePatch),
      });
    }

    await this.audit.record({
      actorId: user.id,
      action: "kyc.check_submitted",
      targetType: "kyc_case",
      targetId: kase.id,
      metadata: { idType: input.idType, country: input.country, checkType: "ID_VERIFICATION" },
    });
    return this.getOwnedCase(user.id, caseId);
  }

  // ── Provider callback ───────────────────────────────────────
  async handleProviderCallback(
    headers: Record<string, string | undefined>,
    rawBody: Buffer | string,
  ): Promise<{ received: boolean; duplicate?: boolean; ignored?: boolean; failed?: boolean }> {
    if (this.provider.name === "NOT_CONFIGURED") {
      throw new ServiceUnavailableException({
        code: "KYC_PROVIDER_NOT_CONFIGURED",
        message: "Identity verification is not configured",
      });
    }
    const verdict = this.provider.verifyCallback(headers, rawBody);
    if (!verdict.ok) {
      await this.audit.record({
        actorType: "PROVIDER",
        action: "kyc.callback_rejected",
        targetType: "kyc_webhook",
        metadata: { reason: verdict.reason ?? "unknown" },
      });
      throw new UnauthorizedException({
        code: "INVALID_SIGNATURE",
        message: "Callback signature verification failed",
      });
    }

    let body: unknown;
    try {
      body = JSON.parse(typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8"));
    } catch {
      throw new BadRequestException({ code: "INVALID_PAYLOAD", message: "Malformed callback" });
    }
    const decision = this.provider.parseCallback(body, headers);
    const eventId = `${decision.providerJobId}:${headers["response-timestamp"] ?? ""}`;

    // dedupe: (provider, provider_event_id) is unique — an existing row means replay
    let event;
    try {
      [event] = await this.db
        .insert(webhookEvents)
        .values({
          provider: WEBHOOK_PROVIDER,
          providerEventId: eventId,
          eventType: "kyc.callback",
          status: "RECEIVED",
          payloadRedacted: decision.rawRedacted,
        })
        .returning();
    } catch (err) {
      if (isUniqueViolation(err)) return { received: true, duplicate: true };
      throw err;
    }

    const [check] = await this.db
      .select()
      .from(kycChecks)
      .where(eq(kycChecks.providerJobId, decision.providerJobId))
      .limit(1);
    if (!check) {
      await this.db
        .update(webhookEvents)
        .set({ status: "IGNORED", processedAt: new Date() })
        .where(eq(webhookEvents.id, event!.id));
      return { received: true, ignored: true };
    }
    // Provider retry with a new Response-Timestamp is a NEW provider_event_id —
    // if the check already reached a terminal state the decision was applied
    // before; re-applying would be an illegal transition and a pointless 409.
    if (check.status !== "PENDING") {
      await this.db
        .update(webhookEvents)
        .set({ status: "DUPLICATE", processedAt: new Date() })
        .where(eq(webhookEvents.id, event!.id));
      return { received: true, duplicate: true };
    }
    const [kase] = await this.db
      .select()
      .from(kycCases)
      .where(eq(kycCases.id, check.caseId))
      .limit(1);
    if (!kase) {
      await this.db
        .update(webhookEvents)
        .set({ status: "IGNORED", processedAt: new Date() })
        .where(eq(webhookEvents.id, event!.id));
      return { received: true, ignored: true };
    }

    try {
      await this.db.transaction(async (tx) => {
        await this.applyDecision(tx as Database, kase, check, decision, "PROVIDER", null);
        await tx
          .update(webhookEvents)
          .set({ status: "PROCESSED", processedAt: new Date() })
          .where(eq(webhookEvents.id, event!.id));
      });
    } catch (err) {
      // illegal state transition or DB failure — mark the event for ops review
      await this.db
        .update(webhookEvents)
        .set({
          status: "FAILED",
          error: err instanceof Error ? err.message : String(err),
          processedAt: new Date(),
        })
        .where(eq(webhookEvents.id, event!.id));
      if (err instanceof Error && err.message.startsWith("illegal")) {
        throw new ConflictException({
          code: "KYC_INVALID_STATE",
          message: "Decision does not apply to the current case state",
        });
      }
      throw err;
    }

    await this.audit.record({
      actorType: "PROVIDER",
      action: "kyc.provider_decision",
      targetType: "kyc_case",
      targetId: kase.id,
      diffRedacted: { outcome: decision.outcome },
    });
    return { received: true };
  }

  /** owner- or admin-triggered status refresh for an open case */
  async syncFromProvider(caseId: string): Promise<void> {
    const [kase] = await this.db.select().from(kycCases).where(eq(kycCases.id, caseId)).limit(1);
    if (!kase) throw new NotFoundException({ code: "CASE_NOT_FOUND", message: "Case not found" });
    if (!OPEN_STATUSES.includes(kase.status)) return;

    const pending = await this.db
      .select()
      .from(kycChecks)
      .where(and(eq(kycChecks.caseId, caseId), eq(kycChecks.status, "PENDING")))
      .orderBy(desc(kycChecks.createdAt))
      .limit(1);
    const check = pending[0];
    if (!check?.providerJobId) return;

    let decision: KycDecision;
    try {
      decision = await this.provider.fetchDecision(check.providerJobId);
    } catch (err) {
      if (err instanceof KycNotConfiguredError || this.provider.name === "NOT_CONFIGURED") {
        throw new ServiceUnavailableException({
          code: "KYC_PROVIDER_NOT_CONFIGURED",
          message: "Identity verification is not configured",
        });
      }
      throw new BadGatewayException({
        code: "KYC_PROVIDER_ERROR",
        message: "Identity verification provider error",
      });
    }
    if (decision.outcome === "PENDING") {
      await this.db
        .update(kycCases)
        .set({ lastProviderSyncAt: new Date() })
        .where(eq(kycCases.id, caseId));
      return;
    }
    await this.db.transaction(async (tx) => {
      await this.applyDecision(tx as Database, kase, check, decision, "PROVIDER", null);
    });
    await this.audit.record({
      actorType: "PROVIDER",
      action: "kyc.provider_decision",
      targetType: "kyc_case",
      targetId: caseId,
      metadata: { via: "sync" },
      diffRedacted: { outcome: decision.outcome },
    });
  }

  /**
   * Apply a normalized provider/admin decision inside a transaction.
   * The case moves through the domain machine — when the target isn't directly
   * reachable (e.g. SUBMITTED → APPROVED) it transitions via IN_REVIEW.
   */
  private async applyDecision(
    tx: Database,
    kase: Case,
    check: Check | null,
    decision: KycDecision,
    source: "PROVIDER" | "ADMIN",
    reviewerId: string | null,
  ) {
    const targetByOutcome: Partial<Record<KycDecision["outcome"], KycState>> = {
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
      NEEDS_REVIEW: "IN_REVIEW",
      ERROR: "MORE_INFO_REQUIRED",
    };
    const target = targetByOutcome[decision.outcome];

    if (check) {
      const checkStatus =
        decision.outcome === "ERROR"
          ? "FAILED"
          : decision.outcome === "PENDING"
            ? "PENDING"
            : "COMPLETED";
      await tx
        .update(kycChecks)
        .set({
          status: checkStatus,
          outcome: decision.outcome,
          reasonCodes: decision.reasonCodes,
          providerMessage: decision.message ?? null,
          rawRedacted: decision.rawRedacted,
          completedAt: decision.completedAt ?? (checkStatus === "PENDING" ? null : new Date()),
          updatedAt: new Date(),
        })
        .where(eq(kycChecks.id, check.id));
    }

    if (!target || target === kase.status) {
      await tx
        .update(kycCases)
        .set({ lastProviderSyncAt: new Date() })
        .where(eq(kycCases.id, kase.id));
      return;
    }

    this.transition(kase.status, target);

    const patch: Partial<typeof kycCases.$inferInsert> = {
      status: target,
      reasonCodes: decision.reasonCodes,
      lastProviderSyncAt: new Date(),
      updatedAt: new Date(),
    };
    if (target === "APPROVED") {
      patch.currentTier = kase.requestedTier;
      patch.reviewedAt = new Date();
      patch.closedAt = new Date();
    }
    if (target === "REJECTED") {
      patch.reviewedAt = new Date();
      patch.closedAt = new Date();
    }
    await tx.update(kycCases).set(patch).where(eq(kycCases.id, kase.id));

    await tx.insert(kycDecisions).values({
      caseId: kase.id,
      checkId: check?.id ?? null,
      reviewerId,
      source,
      decision: decision.outcome,
      reason: decision.message ?? null,
      fromStatus: kase.status,
      toStatus: target,
      policyVersion: kase.policyVersion,
    });
  }

  /** assert a machine transition, hopping via IN_REVIEW when needed */
  private transition(from: KycState, to: KycState) {
    if (kycMachine.canTransition(from, to)) {
      kycMachine.assertTransition(from, to);
      return;
    }
    if (kycMachine.canTransition(from, "IN_REVIEW") && kycMachine.canTransition("IN_REVIEW", to)) {
      kycMachine.assertTransition(from, "IN_REVIEW");
      kycMachine.assertTransition("IN_REVIEW", to);
      return;
    }
    kycMachine.assertTransition(from, to); // throws
  }

  // ── Documents ───────────────────────────────────────────────
  async uploadDocument(
    user: InternalUser,
    caseId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
    docType: string,
  ): Promise<KycDocumentDto> {
    const kase = await this.ownedCase(user.id, caseId);
    if (kase.status !== "DRAFT" && kase.status !== "MORE_INFO_REQUIRED") {
      throw new ConflictException({
        code: "KYC_INVALID_STATE",
        message: "Documents can only be added to a draft or open case",
      });
    }
    const [allowedTypes, maxBytes, count] = await Promise.all([
      this.policies.get(POLICY.kycDocumentAllowedTypes),
      this.policies.get(POLICY.kycDocumentMaxBytes),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(kycDocuments)
        .where(and(eq(kycDocuments.caseId, caseId), sql`${kycDocuments.deletedAt} IS NULL`)),
    ]);
    if ((count[0]?.n ?? 0) >= MAX_DOCUMENTS_PER_CASE) {
      throw new ConflictException({
        code: "KYC_DOC_LIMIT",
        message: `A case may hold at most ${MAX_DOCUMENTS_PER_CASE} documents`,
      });
    }
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException({
        code: "KYC_DOC_TYPE",
        message: "File type is not accepted",
      });
    }
    if (file.size > maxBytes) {
      throw new BadRequestException({
        code: "KYC_DOC_TOO_LARGE",
        message: `File exceeds the ${maxBytes}-byte limit`,
      });
    }
    const magic = MAGIC[file.mimetype];
    if (magic && !magic.every((b, i) => file.buffer[i] === b)) {
      throw new BadRequestException({
        code: "KYC_DOC_TYPE",
        message: "File content does not match its declared type",
      });
    }

    const bucket = this.config.get("KYC_DOCUMENTS_BUCKET");
    const path = `${user.id}/${caseId}/${randomUUID()}`;
    const storageKey = await this.storage.uploadPrivate(bucket, path, file.buffer, file.mimetype);
    const [doc] = await this.db
      .insert(kycDocuments)
      .values({
        caseId,
        docType,
        storageKey,
        bucket,
        contentType: file.mimetype,
        sizeBytes: file.size,
        sha256: createHash("sha256").update(file.buffer).digest("hex"),
        uploadedBy: user.id,
      })
      .returning();
    await this.audit.record({
      actorId: user.id,
      action: "kyc.document_uploaded",
      targetType: "kyc_document",
      targetId: doc!.id,
      metadata: { docType, contentType: file.mimetype, sizeBytes: file.size },
    });
    return this.toDocumentDto(doc!);
  }

  /** signed URL — owner or an actor with kyc.documents.view; admin views audited */
  async documentUrl(
    actor: InternalUser,
    docId: string,
  ): Promise<{ url: string; expiresIn: number }> {
    const [doc] = await this.db
      .select()
      .from(kycDocuments)
      .where(eq(kycDocuments.id, docId))
      .limit(1);
    if (!doc || doc.deletedAt) {
      throw new NotFoundException({ code: "DOC_NOT_FOUND", message: "Document not found" });
    }
    const [kase] = await this.db
      .select({ userId: kycCases.userId })
      .from(kycCases)
      .where(eq(kycCases.id, doc.caseId))
      .limit(1);
    const isOwner = kase?.userId === actor.id;
    if (!isOwner) {
      const perms = await this.roles.permissionsFor(actor.id);
      if (!perms.has("kyc.documents.view")) {
        throw new ForbiddenException({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }
      await this.audit.record({
        actorId: actor.id,
        actorType: "ADMIN",
        action: "kyc.document_viewed",
        targetType: "kyc_document",
        targetId: docId,
      });
    }
    const url = await this.storage.createSignedUrl(doc.storageKey!, SIGNED_URL_TTL_S);
    return { url, expiresIn: SIGNED_URL_TTL_S };
  }

  async deleteDocument(owner: InternalUser, docId: string): Promise<void> {
    const [doc] = await this.db
      .select()
      .from(kycDocuments)
      .where(eq(kycDocuments.id, docId))
      .limit(1);
    if (!doc || doc.deletedAt) {
      throw new NotFoundException({ code: "DOC_NOT_FOUND", message: "Document not found" });
    }
    const [kase] = await this.db
      .select()
      .from(kycCases)
      .where(eq(kycCases.id, doc.caseId))
      .limit(1);
    if (!kase || kase.userId !== owner.id) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Not your document" });
    }
    if (kase.status !== "DRAFT" && kase.status !== "MORE_INFO_REQUIRED") {
      throw new ConflictException({
        code: "KYC_INVALID_STATE",
        message: "Documents can only be removed from a draft or open case",
      });
    }
    await this.db
      .update(kycDocuments)
      .set({ deletedAt: new Date() })
      .where(eq(kycDocuments.id, docId));
    await this.storage.delete(doc.storageKey!);
  }

  // ── Admin ───────────────────────────────────────────────────
  async listCases(query: AdminKycQuery): Promise<Paginated<AdminKycCaseDto>> {
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(kycCases.status, query.status));
    if (query.cursor) {
      const decoded = Buffer.from(query.cursor, "base64url").toString("utf-8");
      const idx = decoded.lastIndexOf("|");
      const ts = new Date(decoded.slice(0, idx));
      const id = decoded.slice(idx + 1);
      conditions.push(sql`(${kycCases.createdAt}, ${kycCases.id}) < (${ts}, ${id})`);
    }
    const rows = await this.db
      .select()
      .from(kycCases)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(kycCases.createdAt), desc(kycCases.id))
      .limit(query.limit + 1);
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      items: await Promise.all(page.map((c) => this.adminCaseView(c))),
      nextCursor:
        rows.length > query.limit && last
          ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString("base64url")
          : null,
    };
  }

  async getCaseAdmin(caseId: string, actorId: string): Promise<AdminKycCaseDto> {
    const [kase] = await this.db.select().from(kycCases).where(eq(kycCases.id, caseId)).limit(1);
    if (!kase) throw new NotFoundException({ code: "CASE_NOT_FOUND", message: "Case not found" });
    await this.audit.record({
      actorId,
      actorType: "ADMIN",
      action: "kyc.case_viewed",
      targetType: "kyc_case",
      targetId: caseId,
    });
    return this.adminCaseView(kase);
  }

  async decide(
    actor: InternalUser,
    caseId: string,
    input: { decision: "APPROVE" | "REJECT" | "REQUEST_MORE_INFO"; reason: string; tier?: number },
  ): Promise<AdminKycCaseDto> {
    const [kase] = await this.db.select().from(kycCases).where(eq(kycCases.id, caseId)).limit(1);
    if (!kase) throw new NotFoundException({ code: "CASE_NOT_FOUND", message: "Case not found" });
    if (kase.userId === actor.id) {
      throw new ForbiddenException({
        code: "SELF_ACTION_FORBIDDEN",
        message: "Reviewers cannot decide their own case",
      });
    }
    if (!["SUBMITTED", "IN_REVIEW", "MORE_INFO_REQUIRED"].includes(kase.status)) {
      throw new ConflictException({
        code: "KYC_INVALID_STATE",
        message: `Case cannot be decided while ${kase.status}`,
      });
    }
    const target: KycState =
      input.decision === "APPROVE"
        ? "APPROVED"
        : input.decision === "REJECT"
          ? "REJECTED"
          : "MORE_INFO_REQUIRED";

    await this.db.transaction(async (tx) => {
      this.transition(kase.status, target);
      const patch: Partial<typeof kycCases.$inferInsert> = {
        status: target,
        updatedAt: new Date(),
      };
      if (target === "APPROVED") {
        patch.currentTier = input.tier ?? kase.requestedTier;
        patch.reviewedAt = new Date();
        patch.closedAt = new Date();
      }
      if (target === "REJECTED") {
        patch.reviewedAt = new Date();
        patch.closedAt = new Date();
      }
      await tx.update(kycCases).set(patch).where(eq(kycCases.id, kase.id));
      await tx.insert(kycDecisions).values({
        caseId: kase.id,
        reviewerId: actor.id,
        source: "ADMIN",
        decision: input.decision,
        reason: input.reason,
        fromStatus: kase.status,
        toStatus: target,
        policyVersion: kase.policyVersion,
      });
    });
    await this.audit.record({
      actorId: actor.id,
      actorType: "ADMIN",
      action: "kyc.admin_decision",
      targetType: "kyc_case",
      targetId: caseId,
      diffRedacted: { decision: input.decision, from: kase.status, to: target },
    });
    return this.adminCaseView({ ...kase, status: target });
  }

  async addInternalNote(actor: InternalUser, caseId: string, note: string): Promise<void> {
    const [kase] = await this.db.select().from(kycCases).where(eq(kycCases.id, caseId)).limit(1);
    if (!kase) throw new NotFoundException({ code: "CASE_NOT_FOUND", message: "Case not found" });
    const line = `[${new Date().toISOString()}] ${actor.id}: ${note}`;
    await this.db
      .update(kycCases)
      .set({
        notesInternal: kase.notesInternal ? `${kase.notesInternal}\n${line}` : line,
        updatedAt: new Date(),
      })
      .where(eq(kycCases.id, caseId));
  }

  // ── Views ───────────────────────────────────────────────────
  async getOwnedCase(userId: string, caseId: string): Promise<KycCaseDto> {
    const kase = await this.ownedCase(userId, caseId);
    return this.caseView(kase, await this.checksFor(kase.id));
  }

  private async ownedCase(userId: string, caseId: string): Promise<Case> {
    const [kase] = await this.db
      .select()
      .from(kycCases)
      .where(and(eq(kycCases.id, caseId), eq(kycCases.userId, userId)))
      .limit(1);
    if (!kase) throw new NotFoundException({ code: "CASE_NOT_FOUND", message: "Case not found" });
    return kase;
  }

  private async checksFor(caseId: string) {
    return this.db.select().from(kycChecks).where(eq(kycChecks.caseId, caseId));
  }

  private toCheckDto(c: Check): KycCheckDto {
    return {
      id: c.id,
      checkType: c.checkType,
      idType: c.idType,
      idNumberLast4: c.idNumberLast4,
      country: c.country,
      status: c.status,
      outcome: c.outcome,
      createdAt: c.createdAt.toISOString(),
      completedAt: c.completedAt?.toISOString() ?? null,
    };
  }

  private toDocumentDto(d: typeof kycDocuments.$inferSelect): KycDocumentDto {
    return {
      id: d.id,
      docType: d.docType,
      contentType: d.contentType,
      sizeBytes: d.sizeBytes,
      createdAt: d.createdAt.toISOString(),
    };
  }

  private async caseView(kase: Case, checks: Check[]): Promise<KycCaseDto> {
    const docs = await this.db
      .select()
      .from(kycDocuments)
      .where(and(eq(kycDocuments.caseId, kase.id), sql`${kycDocuments.deletedAt} IS NULL`));
    return {
      id: kase.id,
      status: kase.status,
      requestedTier: kase.requestedTier,
      currentTier: kase.currentTier,
      submittedAt: kase.submittedAt?.toISOString() ?? null,
      reviewedAt: kase.reviewedAt?.toISOString() ?? null,
      expiresAt: kase.expiresAt?.toISOString() ?? null,
      createdAt: kase.createdAt.toISOString(),
      checks: checks.map((c) => this.toCheckDto(c)),
      documents: docs.map((d) => this.toDocumentDto(d)),
    };
  }

  private async adminCaseView(kase: Case): Promise<AdminKycCaseDto> {
    const [checks, decisions, owner] = await Promise.all([
      this.checksFor(kase.id),
      this.db.select().from(kycDecisions).where(eq(kycDecisions.caseId, kase.id)),
      this.db.select({ email: users.email }).from(users).where(eq(users.id, kase.userId)).limit(1),
    ]);
    const base = await this.caseView(kase, checks);
    return {
      ...base,
      userId: kase.userId,
      userEmail: owner[0]?.email ?? null,
      providerUserId: kase.providerUserId,
      policyVersion: kase.policyVersion,
      reasonCodes: kase.reasonCodes,
      notesInternal: kase.notesInternal,
      checks: checks.map((c) => ({
        ...this.toCheckDto(c),
        reasonCodes: c.reasonCodes,
        providerMessage: c.providerMessage,
      })),
      decisions: decisions.map((d): KycDecisionDto => ({
        id: d.id,
        source: d.source,
        decision: d.decision,
        reason: d.reason,
        fromStatus: d.fromStatus,
        toStatus: d.toStatus,
        reviewerId: d.reviewerId,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  }
}
