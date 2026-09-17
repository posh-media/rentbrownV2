import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  KycCaseHandle,
  KycDecision,
  KycProvider,
  KycSubmitRequest,
} from "@rentbrown/providers";
import { redactKycPayload } from "@rentbrown/providers";
import type { AppConfigService } from "../../../config/config.service.js";

export type KycProviderErrorCode =
  "PROVIDER_UNAVAILABLE" | "PROVIDER_REJECTED_REQUEST" | "PROVIDER_AUTH_FAILED";

export class KycProviderError extends Error {
  constructor(
    public readonly code: KycProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "KycProviderError";
  }
}

const BASE_URLS = {
  sandbox: "https://testapi.smileidentity.com",
  production: "https://api.smileidentity.com",
} as const;

const TOKEN_TTL_MS = 13 * 60 * 1000; // provider tokens live 15 min
const REQUEST_TIMEOUT_MS = 15_000;
const CALLBACK_MAX_AGE_MS = 10 * 60 * 1000; // replay window

const OUTCOME_MAP: Record<string, KycDecision["outcome"]> = {
  clear: "APPROVED",
  block: "REJECTED",
  attention: "NEEDS_REVIEW",
  error: "ERROR",
  processing: "PENDING",
  not_found: "PENDING",
};

/**
 * Smile Identity v3 adapter — multipart submissions, JWT bearer obtained from
 * /v3/token (cached ~13 min, refreshed on 401). Error messages NEVER carry
 * provider response bodies; a redacted copy is logged server-side.
 * Constructed via factory (KYC_PROVIDER token) — plain class, not DI-managed.
 */
export class SmileIdentityKycProvider implements KycProvider {
  readonly name = "SMILE_IDENTITY";

  private readonly baseUrl: string;
  private readonly partnerId: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(config: AppConfigService, fetchImpl: typeof fetch = fetch) {
    this.baseUrl = BASE_URLS[config.get("SMILE_IDENTITY_ENV")];
    // numeric partner id — strip any leading zeros defensively
    this.partnerId = String(config.get("SMILE_IDENTITY_PARTNER_ID") ?? "").replace(/^0+/, "");
    this.apiKey = config.get("SMILE_IDENTITY_API_KEY") ?? "";
    this.fetchImpl = fetchImpl;
  }

  private logError(op: string, status: number | string, body: unknown) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "smile_identity.error",
        op,
        status,
        body: redactKycPayload(body),
      }),
    );
  }

  private async getToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.token && this.token.expiresAt > Date.now()) {
      return this.token.value;
    }
    const res = await this.fetchWithTimeout(`${this.baseUrl}/v3/token`, {
      method: "POST",
      headers: {
        "SmileID-Partner-ID": this.partnerId,
        "SmileID-API-Key": this.apiKey,
      },
      body: new FormData(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => undefined);
      this.logError("token", res.status, body);
      throw this.errorFor(res.status, "token request failed");
    }
    const body = (await res.json()) as { token?: string };
    if (!body.token) throw new KycProviderError("PROVIDER_UNAVAILABLE", "empty provider token");
    this.token = { value: body.token, expiresAt: Date.now() + TOKEN_TTL_MS };
    return body.token;
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await this.fetchImpl(url, { ...init, signal: ctrl.signal });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new KycProviderError("PROVIDER_UNAVAILABLE", "provider request timed out");
      }
      throw new KycProviderError("PROVIDER_UNAVAILABLE", "provider request failed");
    } finally {
      clearTimeout(timer);
    }
  }

  private errorFor(status: number, op: string): KycProviderError {
    if (status === 401 || status === 403) {
      return new KycProviderError("PROVIDER_AUTH_FAILED", `${op}: provider auth failed`);
    }
    if (status >= 400 && status < 500) {
      return new KycProviderError("PROVIDER_REJECTED_REQUEST", `${op}: provider rejected request`);
    }
    return new KycProviderError("PROVIDER_UNAVAILABLE", `${op}: provider unavailable`);
  }

  private async authedFetch(path: string, init: RequestInit, retried = false): Promise<Response> {
    const token = await this.getToken(retried);
    const headers = new Headers(init.headers);
    headers.set("SmileID-Token", token);
    const res = await this.fetchWithTimeout(`${this.baseUrl}${path}`, { ...init, headers });
    if (res.status === 401 && !retried) {
      return this.authedFetch(path, init, true); // one refresh-and-retry
    }
    return res;
  }

  async submitCheck(req: KycSubmitRequest): Promise<KycCaseHandle> {
    const form = new FormData();
    form.set("country", req.country);
    form.set("id_type", req.idType);
    form.set("id_number", req.idNumber);
    form.set(
      "user_details",
      JSON.stringify({
        given_names: req.person.firstName,
        last_name: req.person.lastName,
        ...(req.person.email ? { email: req.person.email } : {}),
        ...(req.person.dob ? { dob: req.person.dob } : {}),
      }),
    );
    form.set(
      "consent",
      JSON.stringify({
        granted: true,
        granted_at: req.consent.grantedAt.toISOString(),
        notice_language: "EN",
        notice_privacy_policy_url: req.consent.privacyPolicyUrl,
      }),
    );
    form.set(
      "partner_params",
      JSON.stringify({ case_id: req.caseId, check_id: req.checkId, user_id: req.userId }),
    );
    if (req.callbackUrl) form.set("callback_url", req.callbackUrl);

    const res = await this.authedFetch("/v3/enhanced_kyc", { method: "POST", body: form });
    const body = (await res.json().catch(() => undefined)) as
      { job_id?: string; user_id?: string } | undefined;
    if (res.status !== 202 || !body?.job_id) {
      this.logError("enhanced_kyc", res.status, body);
      throw this.errorFor(res.status, "submitCheck");
    }
    return { provider: this.name, providerJobId: body.job_id, providerUserId: body.user_id };
  }

  async fetchDecision(providerJobId: string): Promise<KycDecision> {
    const res = await this.authedFetch(`/v3/status/${encodeURIComponent(providerJobId)}`, {
      method: "GET",
    });
    if (res.status === 404) {
      return {
        providerJobId,
        outcome: "PENDING",
        reasonCodes: ["not_found"],
        rawRedacted: {},
      };
    }
    const body = (await res.json().catch(() => undefined)) as Record<string, unknown> | undefined;
    if (!res.ok || !body) {
      this.logError("status", res.status, body);
      throw this.errorFor(res.status, "fetchDecision");
    }
    return {
      providerJobId,
      outcome: OUTCOME_MAP[String(body.status)] ?? "PENDING",
      reasonCodes: typeof body.message === "string" ? [body.message] : [],
      message: typeof body.message === "string" ? body.message : undefined,
      completedAt:
        res.status === 200 && typeof body.created_at === "string"
          ? new Date(body.created_at)
          : undefined,
      rawRedacted: redactKycPayload(body),
    };
  }

  /**
   * base64(HMAC_SHA256(key=api_key, msg=timestamp + partner_id + "sid_request"))
   * compared constant-time; timestamps older than 10 min are rejected (replay).
   */
  verifyCallback(
    headers: Record<string, string | undefined>,
    _rawBody: Buffer | string,
  ): { ok: boolean; reason?: string } {
    const signature = headers["response-signature"];
    const timestamp = headers["response-timestamp"];
    if (!signature || !timestamp) return { ok: false, reason: "missing_signature_headers" };

    // Smile sends ISO-8601 timestamps; accept numeric epoch (s or ms) too
    const parsed = Date.parse(timestamp);
    const numeric = Number(timestamp);
    const tsMs = Number.isFinite(parsed)
      ? parsed
      : Number.isFinite(numeric)
        ? timestamp.length <= 10
          ? numeric * 1000
          : numeric
        : NaN;
    if (!Number.isFinite(tsMs)) return { ok: false, reason: "bad_timestamp" };
    if (Math.abs(Date.now() - tsMs) > CALLBACK_MAX_AGE_MS) {
      return { ok: false, reason: "stale_timestamp" };
    }

    const expected = createHmac("sha256", this.apiKey)
      .update(`${timestamp}${this.partnerId}sid_request`)
      .digest("base64");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "bad_signature" };
    }
    return { ok: true };
  }

  parseCallback(body: unknown, headers: Record<string, string | undefined>): KycDecision {
    const b = (body ?? {}) as Record<string, unknown>;
    const jobId = headers["job-id"] ?? (typeof b.job_id === "string" ? b.job_id : undefined) ?? "";
    const reason = typeof b.reason === "string" ? b.reason : undefined;
    return {
      providerJobId: jobId,
      outcome: OUTCOME_MAP[String(b.status)] ?? "PENDING",
      reasonCodes: reason ? [reason] : [],
      message: typeof b.message === "string" ? b.message : undefined,
      completedAt: typeof b.completed_at === "string" ? new Date(b.completed_at) : undefined,
      rawRedacted: redactKycPayload(b),
    };
  }
}

/** thrown by the NotConfigured adapter — service maps to 503 */
export class KycNotConfiguredError extends Error {
  override name = "KycNotConfiguredError";
}

export class NotConfiguredKycProvider implements KycProvider {
  readonly name = "NOT_CONFIGURED";

  submitCheck(): Promise<KycCaseHandle> {
    throw new KycNotConfiguredError();
  }
  fetchDecision(): Promise<KycDecision> {
    throw new KycNotConfiguredError();
  }
  verifyCallback(): { ok: boolean; reason?: string } {
    throw new KycNotConfiguredError();
  }
  parseCallback(): KycDecision {
    throw new KycNotConfiguredError();
  }
}
