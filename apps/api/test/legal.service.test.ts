import { describe, expect, it, vi } from "vitest";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { AuditService } from "../src/modules/audit/audit.service.js";
import { LegalService } from "../src/modules/legal/legal.service.js";
import { fakeDb } from "./fake-db.js";

const termsDoc = {
  id: "tv-1",
  docType: "TERMS",
  version: "DEV-0.1",
  title: "Terms",
  summary: null,
  contentUrl: null,
  sha256: null,
  isCurrent: true,
  effectiveAt: new Date(),
  publishedAt: new Date(),
};
const privacyDoc = { ...termsDoc, id: "tv-2", docType: "PRIVACY" };

const consentRow = {
  id: "c-1",
  userId: "u1",
  termsVersionId: "tv-1",
  docType: "TERMS",
  version: "DEV-0.1",
  acceptedAt: new Date(),
  ipAddress: null,
  userAgentHash: null,
  platform: null,
};

function makeService(results: unknown[] = []) {
  const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  return { svc: new LegalService(fakeDb(results) as never, audit), audit };
}

describe("LegalService.pendingFor", () => {
  it("returns doc types with no consent on the current version", async () => {
    // current docs → TERMS+PRIVACY; user consents → TERMS only
    const { svc } = makeService([[termsDoc, privacyDoc], [{ termsVersionId: "tv-1" }]]);
    expect(await svc.pendingFor("u1")).toEqual(["PRIVACY"]);
  });

  it("is empty when everything is consented", async () => {
    const { svc } = makeService([
      [termsDoc, privacyDoc],
      [{ termsVersionId: "tv-1" }, { termsVersionId: "tv-2" }],
    ]);
    expect(await svc.pendingFor("u1")).toEqual([]);
  });
});

describe("LegalService.recordConsent", () => {
  it("rejects a non-current version", async () => {
    const stale = { ...termsDoc, isCurrent: false };
    const { svc } = makeService([[stale], [stale]]);
    await expect(svc.recordConsent("u1", "tv-1", {})).rejects.toMatchObject({
      response: { code: "TERMS_VERSION_NOT_CURRENT" },
    });
    await expect(svc.recordConsent("u1", "tv-1", {})).rejects.toBeInstanceOf(ConflictException);
  });

  it("404s on an unknown document", async () => {
    const { svc } = makeService([[]]);
    await expect(svc.recordConsent("u1", "nope", {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it("inserts a consent snapshotting docType/version and audits", async () => {
    const { svc, audit } = makeService([[termsDoc], [consentRow]]);
    const dto = await svc.recordConsent("u1", "tv-1", { ip: "1.2.3.4" });
    expect(dto.docType).toBe("TERMS");
    expect(dto.version).toBe("DEV-0.1");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "legal.consent_recorded" }),
    );
  });

  it("is idempotent — a conflict returns the existing row", async () => {
    // doc select → doc; insert onConflictDoNothing → [] (conflict); re-select → row
    const { svc, audit } = makeService([[termsDoc], [], [consentRow]]);
    const dto = await svc.recordConsent("u1", "tv-1", {});
    expect(dto.id).toBe("c-1");
    expect(audit.record).not.toHaveBeenCalled();
  });
});
