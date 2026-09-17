import { describe, expect, it, vi } from "vitest";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { KycDecision, KycProvider } from "@rentbrown/providers";
import type { StorageProvider } from "@rentbrown/providers";
import type { AppConfigService } from "../src/config/config.service.js";
import type { AuditService } from "../src/modules/audit/audit.service.js";
import type { LegalService } from "../src/modules/legal/legal.service.js";
import type { PoliciesService } from "../src/modules/policies/policies.service.js";
import type { RolesService } from "../src/modules/rbac/roles.service.js";
import { KycService } from "../src/modules/kyc/kyc.service.js";
import type { InternalUser } from "../src/modules/users/users.service.js";
import { fakeDb } from "./fake-db.js";

const user = {
  id: "u1",
  externalSubject: "sub-1",
  email: "a@b.com",
  displayName: "Ada",
  firstName: null,
  lastName: null,
  username: "ada",
  referralCode: "ada",
  accountCurrency: "NGN",
  displayCurrency: "NGN",
  accountStatus: "ACTIVE",
  emailVerifiedAt: null,
  lastSeenAt: null,
  deletedAt: null,
  notificationPrefs: {},
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as InternalUser;

const baseCase = {
  id: "case-1",
  userId: "u1",
  provider: "SMILE_IDENTITY",
  requestedTier: 1,
  currentTier: 0,
  status: "DRAFT",
  policyVersion: "kyc.tiers@1",
  providerUserId: null,
  lastProviderSyncAt: null,
  notesInternal: null,
  closedAt: null,
  submittedAt: null,
  reviewedAt: null,
  expiresAt: null,
  reasonCodes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseCheck = {
  id: "chk-1",
  caseId: "case-1",
  providerJobId: "job-1",
  checkType: "ID_VERIFICATION",
  status: "PENDING",
  idType: "NIN",
  country: "NG",
  idNumberLast4: "8901",
  idNumberHash: "h".repeat(64),
  outcome: null,
  reasonCodes: null,
  providerMessage: null,
  rawRedacted: null,
  result: null,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const submitInput = {
  country: "NG",
  idType: "NIN",
  idNumber: "12345678901",
  firstName: "Amina",
  lastName: "Clearwater",
};

function makeService(
  db: unknown,
  overrides: {
    provider?: Partial<KycProvider>;
    storage?: Partial<StorageProvider>;
    pendingConsents?: string[];
    permissions?: Set<string>;
    policyValues?: Record<string, unknown>;
  } = {},
) {
  const config = {
    get: (k: string) =>
      ({
        API_PUBLIC_URL: "http://localhost:3001",
        SMILE_IDENTITY_CALLBACK_URL: "https://cb.example/hook",
        KYC_DOCUMENTS_BUCKET: "kyc-documents",
      })[k],
  } as unknown as AppConfigService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const policies = {
    get: vi.fn(async (spec: { key?: string; fallback: unknown }) => {
      const v = spec.key ? overrides.policyValues?.[spec.key] : undefined;
      return v !== undefined ? v : spec.fallback;
    }),
    getWithVersion: vi.fn(async (spec: { fallback: unknown }) => ({
      value: spec.fallback,
      version: 1,
    })),
  } as unknown as PoliciesService;
  const legal = {
    pendingFor: vi.fn().mockResolvedValue(overrides.pendingConsents ?? []),
  } as unknown as LegalService;
  const roles = {
    permissionsFor: vi.fn().mockResolvedValue(overrides.permissions ?? new Set()),
  } as unknown as RolesService;
  const provider = {
    name: "SMILE_IDENTITY",
    submitCheck: vi.fn().mockResolvedValue({
      provider: "SMILE_IDENTITY",
      providerJobId: "job-1",
      providerUserId: "su-1",
    }),
    fetchDecision: vi.fn(),
    verifyCallback: vi.fn().mockReturnValue({ ok: true }),
    parseCallback: vi.fn(),
    ...overrides.provider,
  } as unknown as KycProvider;
  const storage = {
    name: "SUPABASE_STORAGE",
    uploadPrivate: vi.fn().mockResolvedValue("kyc-documents/u1/case-1/x"),
    createSignedUrl: vi.fn().mockResolvedValue("https://signed.example/x"),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides.storage,
  } as unknown as StorageProvider;
  const svc = new KycService(db as never, config, audit, policies, legal, roles, provider, storage);
  return { svc, audit, policies, legal, roles, provider, storage };
}

describe("KycService.startCase", () => {
  it("creates a DRAFT case with a policy version snapshot", async () => {
    const db = fakeDb([[{ ...baseCase }], []]);
    const { svc, audit } = makeService(db);
    const out = await svc.startCase(user, 1);
    expect(out.status).toBe("DRAFT");
    expect(db.captures.values[0]).toMatchObject({
      userId: "u1",
      requestedTier: 1,
      status: "DRAFT",
      policyVersion: "kyc.tiers@1",
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kyc.case_started" }),
    );
  });

  it("rejects an unknown tier", async () => {
    const db = fakeDb();
    const { svc, policies } = makeService(db);
    (policies.getWithVersion as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: { "1": { label: "x", checks: [] } },
      version: 3,
    });
    await expect(svc.startCase(user, 9)).rejects.toMatchObject({
      response: { code: "KYC_UNKNOWN_TIER" },
    });
  });

  it("maps the one-open-case unique violation to KYC_CASE_ALREADY_OPEN", async () => {
    const db = fakeDb([Object.assign(new Error("dup"), { code: "23505" })]);
    const { svc } = makeService(db);
    await expect(svc.startCase(user, 1)).rejects.toMatchObject({
      response: { code: "KYC_CASE_ALREADY_OPEN" },
    });
  });

  it("rejects non-active users", async () => {
    const db = fakeDb();
    const { svc } = makeService(db);
    await expect(
      svc.startCase({ ...user, accountStatus: "SUSPENDED" } as InternalUser, 1),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("KycService.submitIdVerification", () => {
  const pendingConsents = [] as string[];

  function queueForSuccess() {
    return fakeDb([
      [{ ...baseCase }], // ownedCase
      [{ ...baseCheck }], // insert check
      [], // tx: update checks
      [], // tx: update cases
      [], // users name fill update
      [{ ...baseCase, status: "SUBMITTED" }], // getOwnedCase → ownedCase
      [{ ...baseCheck }], // checksFor
      [], // documents
    ]);
  }

  it("stores only last4 + hash — never the raw ID number", async () => {
    const db = queueForSuccess();
    const { svc, provider, audit } = makeService(db);
    await svc.submitIdVerification(user, "case-1", submitInput);
    const checkInsert = db.captures.values[0] as Record<string, unknown>;
    expect(checkInsert.idNumberLast4).toBe("8901");
    expect(checkInsert.idNumberHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(db.captures.values)).not.toContain("12345678901");
    expect(JSON.stringify(db.captures.sets)).not.toContain("12345678901");
    expect(provider.submitCheck).toHaveBeenCalledWith(
      expect.objectContaining({ idNumber: "12345678901", caseId: "case-1" }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "kyc.check_submitted",
        metadata: expect.objectContaining({ idType: "NIN", country: "NG" }),
      }),
    );
    // audit metadata must never carry the number either
    for (const call of (audit.record as ReturnType<typeof vi.fn>).mock.calls) {
      expect(JSON.stringify(call[0])).not.toContain("12345678901");
    }
  });

  it("transitions the case DRAFT → SUBMITTED and records provider_job_id", async () => {
    const db = queueForSuccess();
    const { svc } = makeService(db);
    await svc.submitIdVerification(user, "case-1", submitInput);
    expect(db.captures.sets).toContainEqual(expect.objectContaining({ status: "SUBMITTED" }));
    expect(db.captures.sets).toContainEqual(expect.objectContaining({ providerJobId: "job-1" }));
  });

  it("enforces the consent gate", async () => {
    const db = fakeDb([[{ ...baseCase }]]);
    const { svc } = makeService(db, { pendingConsents: ["TERMS@DEV-0.1"] });
    await expect(svc.submitIdVerification(user, "case-1", submitInput)).rejects.toMatchObject({
      response: { code: "CONSENT_REQUIRED" },
    });
  });

  it("rejects a malformed ID number", async () => {
    const db = fakeDb([[{ ...baseCase }]]);
    const { svc } = makeService(db, { pendingConsents });
    await expect(
      svc.submitIdVerification(user, "case-1", { ...submitInput, idNumber: "123" }),
    ).rejects.toMatchObject({ response: { code: "INVALID_ID_NUMBER" } });
  });

  it("rejects an ID type not allowed for the country", async () => {
    const db = fakeDb([[{ ...baseCase }]]);
    const { svc } = makeService(db, {
      policyValues: { "kyc.allowed_id_types": { NG: ["BVN"] } },
    });
    await expect(
      svc.submitIdVerification(user, "case-1", { ...submitInput, idType: "NIN" }),
    ).rejects.toMatchObject({ response: { code: "KYC_ID_TYPE_NOT_ALLOWED" } });
  });

  it("rejects when the case is not in a submittable state", async () => {
    const db = fakeDb([[{ ...baseCase, status: "SUBMITTED" }]]);
    const { svc } = makeService(db);
    await expect(svc.submitIdVerification(user, "case-1", submitInput)).rejects.toMatchObject({
      response: { code: "KYC_INVALID_STATE" },
    });
  });

  it("404s when the case belongs to another user", async () => {
    const db = fakeDb([[]]);
    const { svc } = makeService(db);
    await expect(svc.submitIdVerification(user, "case-1", submitInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("marks the check FAILED and maps provider errors to KYC_PROVIDER_ERROR", async () => {
    const db = fakeDb([[{ ...baseCase }], [{ ...baseCheck }], []]);
    const { svc } = makeService(db, {
      provider: {
        submitCheck: vi
          .fn()
          .mockRejectedValue(Object.assign(new Error("nope"), { code: "PROVIDER_UNAVAILABLE" })),
      },
    });
    await expect(svc.submitIdVerification(user, "case-1", submitInput)).rejects.toMatchObject({
      response: { code: "KYC_PROVIDER_ERROR" },
    });
    expect(db.captures.sets).toContainEqual(
      expect.objectContaining({ status: "FAILED", providerMessage: "PROVIDER_UNAVAILABLE" }),
    );
  });
});

describe("KycService.handleProviderCallback", () => {
  const decision: KycDecision = {
    providerJobId: "job-1",
    outcome: "APPROVED",
    reasonCodes: [],
    message: "ok",
    rawRedacted: { status: "clear" },
  };

  function makeCallbackSvc(
    db: unknown,
    decisionOverride: Partial<KycDecision> = {},
    providerOverride: Partial<KycProvider> = {},
  ) {
    return makeService(db, {
      provider: {
        parseCallback: vi.fn().mockReturnValue({ ...decision, ...decisionOverride }),
        ...providerOverride,
      },
    });
  }

  const headers = { "response-signature": "s", "response-timestamp": "1", "job-id": "job-1" };

  it("rejects a bad signature with 401 and audits it", async () => {
    const db = fakeDb();
    const { svc, audit } = makeService(db, {
      provider: { verifyCallback: vi.fn().mockReturnValue({ ok: false, reason: "bad_signature" }) },
    });
    await expect(svc.handleProviderCallback(headers, "{}")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kyc.callback_rejected", actorType: "PROVIDER" }),
    );
  });

  it("returns duplicate:true on a replayed event", async () => {
    const db = fakeDb([Object.assign(new Error("dup"), { code: "23505" })]);
    const { svc } = makeCallbackSvc(db);
    const out = await svc.handleProviderCallback(headers, "{}");
    expect(out).toEqual({ received: true, duplicate: true });
  });

  it("ignores unknown job ids safely", async () => {
    const db = fakeDb([[{ id: "ev-1" }], [], []]);
    const { svc } = makeCallbackSvc(db, { providerJobId: "nope" });
    const out = await svc.handleProviderCallback(headers, "{}");
    expect(out).toEqual({ received: true, ignored: true });
    expect(db.captures.sets).toContainEqual(expect.objectContaining({ status: "IGNORED" }));
  });

  it("APPROVED completes the check, approves the case, and sets the tier", async () => {
    const db = fakeDb([
      [{ id: "ev-1" }], // insert event
      [{ ...baseCheck }], // find check
      [{ ...baseCase, status: "SUBMITTED" }], // find case
      [], // update check
      [], // update case
      [], // insert decision
      [], // mark event PROCESSED
    ]);
    const { svc, audit } = makeCallbackSvc(db);
    const out = await svc.handleProviderCallback(headers, "{}");
    expect(out).toEqual({ received: true });
    expect(db.captures.sets).toContainEqual(
      expect.objectContaining({ status: "COMPLETED", outcome: "APPROVED" }),
    );
    expect(db.captures.sets).toContainEqual(
      expect.objectContaining({ status: "APPROVED", currentTier: 1 }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kyc.provider_decision", actorType: "PROVIDER" }),
    );
  });

  it("REJECTED rejects the case", async () => {
    const db = fakeDb([
      [{ id: "ev-1" }],
      [{ ...baseCheck }],
      [{ ...baseCase, status: "IN_REVIEW" }],
      [],
      [],
      [],
      [],
    ]);
    const { svc } = makeCallbackSvc(db, { outcome: "REJECTED", reasonCodes: ["name_mismatch"] });
    await svc.handleProviderCallback(headers, "{}");
    expect(db.captures.sets).toContainEqual(expect.objectContaining({ status: "REJECTED" }));
  });

  it("ERROR fails the check and moves the case to MORE_INFO_REQUIRED", async () => {
    const db = fakeDb([
      [{ id: "ev-1" }],
      [{ ...baseCheck }],
      [{ ...baseCase, status: "IN_REVIEW" }],
      [],
      [],
      [],
      [],
    ]);
    const { svc } = makeCallbackSvc(db, { outcome: "ERROR" });
    await svc.handleProviderCallback(headers, "{}");
    expect(db.captures.sets).toContainEqual(expect.objectContaining({ status: "FAILED" }));
    expect(db.captures.sets).toContainEqual(
      expect.objectContaining({ status: "MORE_INFO_REQUIRED" }),
    );
  });

  it("treats a redelivery with a new timestamp as a duplicate when the check already finished", async () => {
    // Smile may retry a job result with a NEW Response-Timestamp → new event id.
    // The check is already terminal, so this must be a harmless 200 duplicate.
    const db = fakeDb([
      [{ id: "ev-2" }], // insert event (different event id — not a unique clash)
      [{ ...baseCheck, status: "COMPLETED", outcome: "APPROVED" }], // find check
      [], // mark event DUPLICATE
    ]);
    const { svc } = makeCallbackSvc(db);
    const out = await svc.handleProviderCallback({ ...headers, "response-timestamp": "2" }, "{}");
    expect(out).toEqual({ received: true, duplicate: true });
    expect(db.captures.sets).toContainEqual(expect.objectContaining({ status: "DUPLICATE" }));
    // case state untouched — no status write
    expect(db.captures.sets).not.toContainEqual(expect.objectContaining({ status: "APPROVED" }));
  });

  it("marks the event FAILED on an illegal transition instead of corrupting state", async () => {
    const db = fakeDb([
      [{ id: "ev-1" }],
      [{ ...baseCheck }],
      [{ ...baseCase, status: "REJECTED" }], // terminal — APPROVED is illegal
      [], // update check inside tx
      [], // mark event FAILED
    ]);
    const { svc } = makeCallbackSvc(db);
    await expect(svc.handleProviderCallback(headers, "{}")).rejects.toMatchObject({
      response: { code: "KYC_INVALID_STATE" },
    });
    expect(db.captures.sets).toContainEqual(expect.objectContaining({ status: "FAILED" }));
    // case status must NOT have been overwritten
    expect(db.captures.sets).not.toContainEqual(expect.objectContaining({ status: "APPROVED" }));
  });
});

describe("KycService documents", () => {
  const jpeg = {
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]),
    mimetype: "image/jpeg",
    size: 5,
  };

  it("rejects a disallowed mimetype", async () => {
    const db = fakeDb([[{ ...baseCase }], [{ n: 0 }]]);
    const { svc } = makeService(db);
    await expect(
      svc.uploadDocument(user, "case-1", { ...jpeg, mimetype: "text/plain" }, "ID_FRONT"),
    ).rejects.toMatchObject({ response: { code: "KYC_DOC_TYPE" } });
  });

  it("rejects files over the policy max", async () => {
    const db = fakeDb([[{ ...baseCase }], [{ n: 0 }]]);
    const { svc } = makeService(db, { policyValues: { "kyc.document_max_bytes": 4 } });
    await expect(svc.uploadDocument(user, "case-1", jpeg, "ID_FRONT")).rejects.toMatchObject({
      response: { code: "KYC_DOC_TOO_LARGE" },
    });
  });

  it("rejects bad magic bytes", async () => {
    const db = fakeDb([[{ ...baseCase }], [{ n: 0 }]]);
    const { svc } = makeService(db);
    await expect(
      svc.uploadDocument(user, "case-1", { ...jpeg, buffer: Buffer.from("notajpeg") }, "ID_FRONT"),
    ).rejects.toMatchObject({ response: { code: "KYC_DOC_TYPE" } });
  });

  it("rejects a 7th document", async () => {
    const db = fakeDb([[{ ...baseCase }], [{ n: 6 }]]);
    const { svc } = makeService(db);
    await expect(svc.uploadDocument(user, "case-1", jpeg, "ID_FRONT")).rejects.toMatchObject({
      response: { code: "KYC_DOC_LIMIT" },
    });
  });

  it("stores object refs (never URLs) and audits the upload", async () => {
    const doc = {
      id: "doc-1",
      caseId: "case-1",
      docType: "ID_FRONT",
      storageKey: "kyc-documents/u1/case-1/x",
      bucket: "kyc-documents",
      contentType: "image/jpeg",
      sizeBytes: 5,
      sha256: "s".repeat(64),
      uploadedBy: "u1",
      providerToken: null,
      retentionStatus: "RETAINED",
      deletedAt: null,
      createdAt: new Date(),
    };
    const db = fakeDb([[{ ...baseCase }], [{ n: 0 }], [doc]]);
    const { svc, audit } = makeService(db);
    const out = await svc.uploadDocument(user, "case-1", jpeg, "ID_FRONT");
    expect(out.id).toBe("doc-1");
    expect(db.captures.values[0]).toMatchObject({
      caseId: "case-1",
      storageKey: "kyc-documents/u1/case-1/x",
      bucket: "kyc-documents",
    });
    expect(JSON.stringify(db.captures.values[0])).not.toContain("http");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kyc.document_uploaded" }),
    );
  });

  const doc = {
    id: "doc-1",
    caseId: "case-1",
    docType: "ID_FRONT",
    storageKey: "kyc-documents/u1/case-1/x",
    deletedAt: null,
    createdAt: new Date(),
  };

  it("owner gets a signed URL without an audit event", async () => {
    const db = fakeDb([[{ ...doc }], [{ userId: "u1" }]]);
    const { svc, audit } = makeService(db);
    const out = await svc.documentUrl(user, "doc-1");
    expect(out.url).toContain("signed.example");
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("admin with kyc.documents.view gets a URL and is audited", async () => {
    const db = fakeDb([[{ ...doc }], [{ userId: "someone-else" }]]);
    const { svc, audit } = makeService(db, { permissions: new Set(["kyc.documents.view"]) });
    const out = await svc.documentUrl({ ...user, id: "admin-1" } as InternalUser, "doc-1");
    expect(out.url).toContain("signed.example");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kyc.document_viewed", actorType: "ADMIN" }),
    );
  });

  it("denies non-owners without the permission", async () => {
    const db = fakeDb([[{ ...doc }], [{ userId: "someone-else" }]]);
    const { svc } = makeService(db);
    await expect(svc.documentUrl(user, "doc-1")).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("KycService.decide (admin)", () => {
  const admin = { ...user, id: "admin-1" } as InternalUser;

  it("forbids reviewing your own case", async () => {
    const db = fakeDb([[{ ...baseCase, status: "SUBMITTED" }]]);
    const { svc } = makeService(db);
    await expect(
      svc.decide(user, "case-1", { decision: "APPROVE", reason: "looks fine" }),
    ).rejects.toMatchObject({ response: { code: "SELF_ACTION_FORBIDDEN" } });
  });

  it("approves a submitted case and sets the tier", async () => {
    const db = fakeDb([
      [{ ...baseCase, status: "SUBMITTED" }],
      [], // update case
      [], // insert decision
      // adminCaseView Promise.all: owner .limit() pops first, then checks/decisions
      [{ email: "a@b.com" }], // owner
      [], // checksFor
      [], // decisions
      [], // caseView → documents
    ]);
    const { svc, audit } = makeService(db);
    const out = await svc.decide(admin, "case-1", { decision: "APPROVE", reason: "verified" });
    expect(out.status).toBe("APPROVED");
    expect(db.captures.sets).toContainEqual(
      expect.objectContaining({ status: "APPROVED", currentTier: 1 }),
    );
    expect(db.captures.values).toContainEqual(
      expect.objectContaining({ source: "ADMIN", reviewerId: "admin-1", toStatus: "APPROVED" }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kyc.admin_decision", actorType: "ADMIN" }),
    );
  });

  it("rejects deciding a terminal case", async () => {
    const db = fakeDb([[{ ...baseCase, status: "APPROVED" }]]);
    const { svc } = makeService(db);
    await expect(
      svc.decide(admin, "case-1", { decision: "APPROVE", reason: "verified" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("KycService.summaryFor", () => {
  it("reports NONE + canStart for a fresh active user", async () => {
    const db = fakeDb([[{ accountStatus: "ACTIVE" }], []]);
    const { svc } = makeService(db);
    const s = await svc.summaryFor("u1");
    expect(s).toMatchObject({ status: "NONE", tier: 0, canStart: true });
  });

  it("reports the approved tier", async () => {
    const db = fakeDb([
      [{ accountStatus: "ACTIVE" }],
      [{ ...baseCase, status: "APPROVED", currentTier: 1 }],
    ]);
    const { svc } = makeService(db);
    const s = await svc.summaryFor("u1");
    expect(s.tier).toBe(1);
    expect(s.status).toBe("APPROVED");
  });
});
