import {
  redactKycPayload,
  type KycCaseHandle,
  type KycDecision,
  type KycProvider,
  type KycSubmitRequest,
} from "@rentbrown/providers";

/**
 * DEV-ONLY KYC provider — exercises the full case/check/decision pipeline
 * (state machine, webhooks, admin review, signed docs) without external
 * credentials. Selected by KYC_PROVIDER=mock; the module factory REFUSES to
 * construct this when APP_ENV=production, so a mis-set env var can never
 * silently verify identities in prod.
 *
 * Behaviour:
 * - submitCheck encodes a deterministic outcome in the job id: a last name
 *   containing "reject"/"fail" yields REJECTED, everything else APPROVED.
 * - fetchDecision returns that outcome (completed, immediately pollable via
 *   POST /v1/kyc/cases/:id/sync).
 * - Callbacks are accepted only with the literal dev header
 *   `x-mock-signature: dev-mock-signature` — no HMAC (nothing to verify).
 */
export class MockKycProvider implements KycProvider {
  readonly name = "MOCK_DEV";
  static readonly SIGNATURE_HEADER = "x-mock-signature";
  static readonly SIGNATURE_VALUE = "dev-mock-signature";

  submitCheck(req: KycSubmitRequest): Promise<KycCaseHandle> {
    const outcome = /reject|fail|danger/i.test(req.person.lastName) ? "REJECTED" : "APPROVED";
    return Promise.resolve({
      provider: this.name,
      providerJobId: `mockjob_${req.checkId}_${outcome}`,
      providerUserId: `mockuser_${req.userId.slice(0, 8)}`,
    });
  }

  fetchDecision(providerJobId: string): Promise<KycDecision> {
    const outcome = providerJobId.endsWith("_REJECTED") ? "REJECTED" : "APPROVED";
    return Promise.resolve({
      providerJobId,
      outcome,
      reasonCodes: outcome === "REJECTED" ? ["MOCK_REJECT"] : [],
      message: outcome === "REJECTED" ? "Mock provider rejection" : "Mock provider approval",
      completedAt: new Date(),
      rawRedacted: redactKycPayload({
        job_id: providerJobId,
        status: outcome === "APPROVED" ? "clear" : "block",
        product: "mock_enhanced_kyc",
      }),
    });
  }

  verifyCallback(headers: Record<string, string | undefined>): { ok: boolean; reason?: string } {
    if (headers[MockKycProvider.SIGNATURE_HEADER] !== MockKycProvider.SIGNATURE_VALUE) {
      return { ok: false, reason: "missing or invalid mock signature header" };
    }
    return { ok: true };
  }

  parseCallback(body: unknown): KycDecision {
    const b = (body ?? {}) as Record<string, unknown>;
    const providerJobId = String(b.job_id ?? "");
    const status = String(b.status ?? "");
    return {
      providerJobId,
      outcome: status === "clear" ? "APPROVED" : status === "block" ? "REJECTED" : "PENDING",
      reasonCodes: status === "block" ? ["MOCK_REJECT"] : [],
      message: `Mock callback (${status || "unknown"})`,
      completedAt: new Date(),
      rawRedacted: redactKycPayload(b),
    };
  }
}
