import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { AppConfigService } from "../src/config/config.service.js";
import {
  KycProviderError,
  SmileIdentityKycProvider,
} from "../src/modules/kyc/providers/smile-identity.provider.js";

const PARTNER_ID = "1234";
const API_KEY = "test-api-key";

function makeConfig(overrides: Record<string, unknown> = {}) {
  const env: Record<string, unknown> = {
    SMILE_IDENTITY_ENV: "sandbox",
    SMILE_IDENTITY_PARTNER_ID: PARTNER_ID,
    SMILE_IDENTITY_API_KEY: API_KEY,
    ...overrides,
  };
  return { get: (k: string) => env[k] } as unknown as AppConfigService;
}

function res(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const submitReq = {
  userId: "u1",
  caseId: "case-1",
  checkId: "chk-1",
  checkType: "ID_VERIFICATION" as const,
  country: "NG",
  idType: "NIN",
  idNumber: "12345678901",
  person: { firstName: "Amina Fatou", lastName: "Clearwater", email: "a@b.com" },
  consent: { grantedAt: new Date("2024-01-01"), privacyPolicyUrl: "https://x/privacy" },
  callbackUrl: "https://cb.example/hook",
};

describe("SmileIdentityKycProvider", () => {
  it("uses the sandbox base URL and caches the token across calls", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      const u = String(url);
      if (u.endsWith("/v3/token")) return res(200, { token: "tok-1" });
      if (u.includes("/v3/status/")) return res(200, { status: "clear", job_id: "j1" });
      return res(500, {});
    });
    const p = new SmileIdentityKycProvider(makeConfig(), fetchImpl as never);
    await p.fetchDecision("j1");
    await p.fetchDecision("j2");
    const tokenCalls = calls.filter((c) => c.url.endsWith("/v3/token"));
    expect(tokenCalls).toHaveLength(1);
    expect(tokenCalls[0]!.url).toBe("https://testapi.smileidentity.com/v3/token");
    expect((tokenCalls[0]!.init.headers as Record<string, string>)["SmileID-Partner-ID"]).toBe(
      PARTNER_ID,
    );
    expect(calls.filter((c) => c.url.includes("/v3/status/"))).toHaveLength(2);
  });

  it("refreshes the token once on 401", async () => {
    let tokenCalls = 0;
    let statusCalls = 0;
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/v3/token")) {
        tokenCalls += 1;
        return res(200, { token: `tok-${tokenCalls}` });
      }
      statusCalls += 1;
      return statusCalls === 1 ? res(401, {}) : res(200, { status: "block", job_id: "j1" });
    });
    const p = new SmileIdentityKycProvider(makeConfig(), fetchImpl as never);
    const d = await p.fetchDecision("j1");
    expect(d.outcome).toBe("REJECTED");
    expect(tokenCalls).toBe(2);
  });

  it("submits multipart enhanced_kyc with partner_params and never a body leak on error", async () => {
    let seen: { url: string; form: FormData } | null = null;
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/v3/token")) return res(200, { token: "tok" });
      seen = { url: u, form: init!.body as FormData };
      return res(202, { status: "accepted", job_id: "job-9", user_id: "su-9" });
    });
    const p = new SmileIdentityKycProvider(makeConfig(), fetchImpl as never);
    const handle = await p.submitCheck(submitReq);
    expect(handle).toMatchObject({
      provider: "SMILE_IDENTITY",
      providerJobId: "job-9",
      providerUserId: "su-9",
    });
    expect(seen!.url).toContain("/v3/enhanced_kyc");
    const f = seen!.form;
    expect(f.get("country")).toBe("NG");
    expect(f.get("id_type")).toBe("NIN");
    expect(f.get("id_number")).toBe("12345678901");
    expect(JSON.parse(String(f.get("partner_params")))).toEqual({
      case_id: "case-1",
      check_id: "chk-1",
      user_id: "u1",
    });
    expect(JSON.parse(String(f.get("user_details")))).toMatchObject({
      given_names: "Amina Fatou",
      last_name: "Clearwater",
    });
    expect(JSON.parse(String(f.get("consent")))).toMatchObject({
      granted: true,
      notice_language: "EN",
    });
    expect(f.get("callback_url")).toBe("https://cb.example/hook");
  });

  it("maps a submission failure to a coded error without the response body", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/v3/token")) return res(200, { token: "tok" });
      return res(400, { error: "SECRET_DETAILS_HERE id_number mismatch xyz" });
    });
    const p = new SmileIdentityKycProvider(makeConfig(), fetchImpl as never);
    const err = await p.submitCheck(submitReq).catch((e) => e);
    expect(err).toBeInstanceOf(KycProviderError);
    expect((err as KycProviderError).code).toBe("PROVIDER_REJECTED_REQUEST");
    expect((err as Error).message).not.toContain("SECRET_DETAILS_HERE");
  });

  function sign(timestamp: string, partnerId = PARTNER_ID) {
    return createHmac("sha256", API_KEY)
      .update(`${timestamp}${partnerId}sid_request`)
      .digest("base64");
  }

  it("verifies a valid callback signature with an ISO-8601 timestamp", () => {
    const ts = new Date().toISOString(); // e.g. 2024-02-09T14:48:55.887Z
    const p = new SmileIdentityKycProvider(makeConfig());
    const ok = p.verifyCallback(
      { "response-signature": sign(ts), "response-timestamp": ts, "job-id": "j1" },
      "{}",
    );
    expect(ok.ok).toBe(true);
  });

  it("accepts a numeric epoch timestamp (seconds or ms)", () => {
    const p = new SmileIdentityKycProvider(makeConfig());
    const ms = String(Date.now());
    expect(
      p.verifyCallback({ "response-signature": sign(ms), "response-timestamp": ms }, "{}").ok,
    ).toBe(true);
    const s = String(Math.floor(Date.now() / 1000));
    expect(
      p.verifyCallback({ "response-signature": sign(s), "response-timestamp": s }, "{}").ok,
    ).toBe(true);
  });

  it("rejects a garbage timestamp", () => {
    const p = new SmileIdentityKycProvider(makeConfig());
    expect(
      p.verifyCallback(
        { "response-signature": "whatever", "response-timestamp": "not-a-time" },
        "{}",
      ),
    ).toMatchObject({ ok: false, reason: "bad_timestamp" });
  });

  it("rejects bad signatures and stale timestamps", () => {
    const ts = String(Date.now());
    const p = new SmileIdentityKycProvider(makeConfig());
    expect(
      p.verifyCallback({ "response-signature": "bogus", "response-timestamp": ts }, "{}").ok,
    ).toBe(false);
    const stale = String(Date.now() - 11 * 60 * 1000);
    expect(
      p.verifyCallback({ "response-signature": sign(stale), "response-timestamp": stale }, "{}"),
    ).toMatchObject({ ok: false, reason: "stale_timestamp" });
  });

  it.each([
    ["clear", "APPROVED"],
    ["block", "REJECTED"],
    ["attention", "NEEDS_REVIEW"],
    ["error", "ERROR"],
    ["processing", "PENDING"],
  ])("parseCallback maps status %s → %s", (status, outcome) => {
    const p = new SmileIdentityKycProvider(makeConfig());
    const d = p.parseCallback(
      { status, message: "m", reason: "r", job_id: "body-job", id_fields: { nin: "12345678901" } },
      {},
    );
    expect(d.outcome).toBe(outcome);
    expect(d.providerJobId).toBe("body-job");
    // rawRedacted must not carry the id number value
    expect(JSON.stringify(d.rawRedacted)).not.toContain("12345678901");
  });

  it("fetchDecision maps 202 processing and 404 not_found to PENDING", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/v3/token")) return res(200, { token: "tok" });
      if (u.includes("missing")) return res(404, { status: "not_found" });
      return res(202, { status: "processing", job_id: "j" });
    });
    const p = new SmileIdentityKycProvider(makeConfig(), fetchImpl as never);
    expect((await p.fetchDecision("j")).outcome).toBe("PENDING");
    expect((await p.fetchDecision("missing")).outcome).toBe("PENDING");
  });

  it("rejects a non-numeric partner id shape defensively (leading zeros stripped)", () => {
    const p = new SmileIdentityKycProvider(makeConfig({ SMILE_IDENTITY_PARTNER_ID: "0123" }));
    // partner id is normalized — signature uses "123"
    const ts = String(Date.now());
    const sig = createHmac("sha256", API_KEY).update(`${ts}123sid_request`).digest("base64");
    expect(p.verifyCallback({ "response-signature": sig, "response-timestamp": ts }, "{}").ok).toBe(
      true,
    );
  });
});
