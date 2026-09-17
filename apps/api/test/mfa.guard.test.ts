import { describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import { MfaGuard } from "../src/common/guards/mfa.guard.js";
import type { AppConfigService } from "../src/config/config.service.js";
import type { PoliciesService } from "../src/modules/policies/policies.service.js";
import type { PolicySpec } from "../src/modules/policies/policies.keys.js";

function ctx(identity: Record<string, unknown>): ExecutionContext {
  const req = { headers: {}, identity };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function config(enforce: string, prod = false): AppConfigService {
  return {
    get: (k: string) => ({ ADMIN_MFA_ENFORCE: enforce })[k],
    isProd: prod,
  } as unknown as AppConfigService;
}

function policies(values: Record<string, unknown>): PoliciesService {
  return {
    get: vi.fn(async (spec: PolicySpec<unknown>) => values[spec.key] ?? spec.fallback),
  } as unknown as PoliciesService;
}

const aal2 = { subject: "u1", aal: "aal2", issuedAt: Math.floor(Date.now() / 1000) };

describe("MfaGuard", () => {
  it("rejects aal1 when the mfa policy is on", async () => {
    const guard = new MfaGuard(config("true"), policies({ "admin.mfa_required": true }));
    await expect(guard.canActivate(ctx({ subject: "u1", aal: "aal1" }))).rejects.toMatchObject({
      response: { code: "MFA_REQUIRED" },
    });
  });

  it("passes aal2", async () => {
    const guard = new MfaGuard(config("true"), policies({ "admin.mfa_required": true }));
    await expect(guard.canActivate(ctx(aal2))).resolves.toBe(true);
  });

  it("dev override skips enforcement outside production", async () => {
    const guard = new MfaGuard(config("false"), policies({ "admin.mfa_required": true }));
    await expect(guard.canActivate(ctx({ subject: "u1", aal: "aal1" }))).resolves.toBe(true);
  });

  it("production ignores the dev override", async () => {
    const guard = new MfaGuard(config("false", true), policies({ "admin.mfa_required": true }));
    await expect(guard.canActivate(ctx({ subject: "u1", aal: "aal1" }))).rejects.toMatchObject({
      response: { code: "MFA_REQUIRED" },
    });
  });

  it("production enforces aal2 even when the policy is false", async () => {
    const guard = new MfaGuard(config("true", true), policies({ "admin.mfa_required": false }));
    await expect(guard.canActivate(ctx({ subject: "u1", aal: "aal1" }))).rejects.toMatchObject({
      response: { code: "MFA_REQUIRED" },
    });
  });

  it("passes when the policy is off", async () => {
    const guard = new MfaGuard(config("true"), policies({ "admin.mfa_required": false }));
    await expect(guard.canActivate(ctx({ subject: "u1", aal: "aal1" }))).resolves.toBe(true);
  });

  it("rejects sessions older than admin.session_max_age_seconds", async () => {
    const guard = new MfaGuard(
      config("true"),
      policies({ "admin.mfa_required": true, "admin.session_max_age_seconds": 60 }),
    );
    const old = { ...aal2, issuedAt: Math.floor(Date.now() / 1000) - 3600 };
    await expect(guard.canActivate(ctx(old))).rejects.toMatchObject({
      response: { code: "SESSION_TOO_OLD" },
    });
    await expect(guard.canActivate(ctx(old))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
