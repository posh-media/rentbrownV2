import { describe, expect, it } from "vitest";
import { createKycProvider } from "../src/modules/kyc/kyc.module.js";
import { MockKycProvider } from "../src/modules/kyc/providers/mock-kyc.provider.js";
import { NotConfiguredKycProvider } from "../src/modules/kyc/providers/smile-identity.provider.js";
import type { AppConfigService } from "../src/config/config.service.js";
import type { KycSubmitRequest } from "@rentbrown/providers";

const cfg = (env: Record<string, string | undefined>, prod = false) =>
  ({
    get: (k: string) => env[k],
    isProd: prod,
  }) as unknown as AppConfigService;

describe("createKycProvider factory", () => {
  it("returns the mock provider in development when KYC_PROVIDER=mock", () => {
    expect(createKycProvider(cfg({ KYC_PROVIDER: "mock" }))).toBeInstanceOf(MockKycProvider);
  });

  it("REFUSES the mock provider in production — fails at boot, never silently", () => {
    expect(() => createKycProvider(cfg({ KYC_PROVIDER: "mock" }, true))).toThrow(/forbidden/);
  });

  it("falls back to NotConfigured when Smile creds are absent", () => {
    expect(createKycProvider(cfg({}))).toBeInstanceOf(NotConfiguredKycProvider);
  });

  it("ignores stray Smile creds when mock is explicitly selected", () => {
    const p = createKycProvider(
      cfg({ KYC_PROVIDER: "mock", SMILE_IDENTITY_PARTNER_ID: "x", SMILE_IDENTITY_API_KEY: "y" }),
    );
    expect(p).toBeInstanceOf(MockKycProvider);
  });
});

const req = (lastName: string): KycSubmitRequest => ({
  userId: "user-12345678",
  caseId: "case-1",
  checkId: "check-1",
  checkType: "ID_VERIFICATION",
  country: "NG",
  idType: "NIN",
  idNumber: "00000000000",
  person: { firstName: "Test", lastName },
  consent: { grantedAt: new Date(), privacyPolicyUrl: "https://example.com/privacy" },
});

describe("MockKycProvider (dev-only)", () => {
  const mock = new MockKycProvider();

  it("approves by default and encodes the outcome in the job id", async () => {
    const handle = await mock.submitCheck(req("Clearwater"));
    expect(handle.providerJobId).toContain("check-1");
    expect(handle.providerJobId.endsWith("_APPROVED")).toBe(true);
    const decision = await mock.fetchDecision(handle.providerJobId);
    expect(decision.outcome).toBe("APPROVED");
    expect(decision.providerJobId).toBe(handle.providerJobId);
  });

  it("rejects when the last name signals rejection", async () => {
    const handle = await mock.submitCheck(req("Rejectson"));
    const decision = await mock.fetchDecision(handle.providerJobId);
    expect(decision.outcome).toBe("REJECTED");
    expect(decision.reasonCodes).toContain("MOCK_REJECT");
  });

  it("never persists the raw id number in redacted payloads", async () => {
    const decision = await mock.fetchDecision("mockjob_x_APPROVED");
    expect(JSON.stringify(decision.rawRedacted)).not.toContain("00000000000");
  });

  it("accepts callbacks only with the dev signature header", () => {
    expect(mock.verifyCallback({}).ok).toBe(false);
    expect(mock.verifyCallback({ "x-mock-signature": "dev-mock-signature" }).ok).toBe(true);
  });

  it("maps callback statuses to outcomes", () => {
    expect(mock.parseCallback({ job_id: "j1", status: "clear" }).outcome).toBe("APPROVED");
    expect(mock.parseCallback({ job_id: "j1", status: "block" }).outcome).toBe("REJECTED");
    expect(mock.parseCallback({ job_id: "j1", status: "processing" }).outcome).toBe("PENDING");
  });
});
