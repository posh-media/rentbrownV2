import { describe, expect, it, vi } from "vitest";
import type { PoliciesService } from "../src/modules/policies/policies.service.js";
import { KycPolicyService } from "../src/modules/kyc/kyc-policy.service.js";
import { fakeDb } from "./fake-db.js";

function makeService(db: unknown, gate: unknown) {
  const policies = {
    get: vi.fn(async (spec: { fallback: unknown }) => (gate === undefined ? spec.fallback : gate)),
  } as unknown as PoliciesService;
  return new KycPolicyService(db as never, policies);
}

describe("KycPolicyService.evaluate", () => {
  it("is satisfied when the gate is disabled", async () => {
    const db = fakeDb([[[]]]);
    const svc = makeService(db, { enabled: false, requiredTier: 2 });
    const g = await svc.evaluate("u1", "withdrawal");
    expect(g).toMatchObject({ required: false, satisfied: true, requiredTier: 2 });
  });

  it("is satisfied when the user's approved tier meets the requirement", async () => {
    const db = fakeDb([[{ tier: 1 }]]);
    const svc = makeService(db, { enabled: true, requiredTier: 1 });
    const g = await svc.evaluate("u1", "withdrawal");
    expect(g).toMatchObject({ required: true, satisfied: true, currentTier: 1 });
  });

  it("is unsatisfied when the tier is short", async () => {
    const db = fakeDb([[{ tier: 1 }]]);
    const svc = makeService(db, { enabled: true, requiredTier: 2 });
    const g = await svc.evaluate("u1", "withdrawal");
    expect(g).toMatchObject({ satisfied: false, requiredTier: 2, currentTier: 1 });
  });

  it("falls back to the spec default when the stored policy is invalid/absent", async () => {
    const db = fakeDb([[[]]]);
    const svc = makeService(db, undefined); // returns spec.fallback → {enabled:true,requiredTier:1}
    const g = await svc.evaluate("u1", "withdrawal");
    expect(g).toMatchObject({ required: true, requiredTier: 1, satisfied: false });
    expect(g.policyKey).toBe("kyc.withdrawal_gate");
  });
});
