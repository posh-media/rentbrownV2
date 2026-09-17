import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AuditService } from "../src/modules/audit/audit.service.js";
import { PoliciesService } from "../src/modules/policies/policies.service.js";
import { POLICY } from "../src/modules/policies/policies.keys.js";
import { fakeDb } from "./fake-db.js";

function makeService(results: unknown[] = []) {
  const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  return { svc: new PoliciesService(fakeDb(results) as never, audit), audit };
}

describe("PoliciesService.get", () => {
  it("returns the stored value when it validates", async () => {
    const { svc } = makeService([[{ value: false }]]);
    expect(await svc.get(POLICY.adminMfaRequired)).toBe(false);
  });

  it("falls back when the stored value fails schema validation", async () => {
    const { svc } = makeService([[{ value: "not-a-boolean" }]]);
    expect(await svc.get(POLICY.adminMfaRequired)).toBe(true);
  });

  it("falls back on a DB error", async () => {
    const { svc } = makeService([new Error("connection refused")]);
    expect(await svc.get(POLICY.usernameChangeAllowed)).toBe(true);
  });

  it("supports the explicit (key, schema, fallback) signature", async () => {
    const { svc } = makeService([[{ value: 5 }]]);
    expect(await svc.get("custom.key", z.number(), 1)).toBe(5);
  });
});

describe("PoliciesService.set", () => {
  it("upserts with version+1, invalidates the cache, and audits versions only", async () => {
    // prime the cache (get → row); set → select existing → update
    const { svc, audit } = makeService([
      [{ value: true }], // get
      [{ key: "admin.mfa_required", value: true, version: 3 }], // set: select existing
      [], // update
    ]);
    await svc.get(POLICY.adminMfaRequired);
    await svc.set("admin.mfa_required", false, "admin-1");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "policy.updated",
        diffRedacted: { key: "admin.mfa_required", fromVersion: 3, toVersion: 4 },
      }),
    );
    // cache invalidated: next get hits the fake again → new value
    (svc as unknown as { db: unknown }).db = fakeDb([[{ value: false }]]);
    expect(await svc.get(POLICY.adminMfaRequired)).toBe(false);
  });
});
