import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { AppConfigService } from "../../config/config.service.js";
import { PoliciesService } from "../../modules/policies/policies.service.js";
import { POLICY } from "../../modules/policies/policies.keys.js";
import type { AuthenticatedRequest } from "./supabase-auth.guard.js";

/**
 * Admin session hardening — enforces the `admin.mfa_required` policy (Supabase
 * aal2) and `admin.session_max_age_seconds`. ADMIN_MFA_ENFORCE=false is a
 * development override only: production always enforces regardless of it.
 * Runs after SupabaseAuthGuard; PoliciesService is global via PoliciesModule.
 */
@Injectable()
export class MfaGuard implements CanActivate {
  constructor(
    private readonly config: AppConfigService,
    private readonly policies: PoliciesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.identity) throw new UnauthorizedException();

    // production ALWAYS enforces aal2 — a runtime policy flip must never be
    // able to disable admin MFA. Outside prod, ADMIN_MFA_ENFORCE=false is the
    // dev escape hatch; otherwise the admin.mfa_required policy decides.
    const mfaRequired =
      this.config.isProd ||
      (this.config.get("ADMIN_MFA_ENFORCE") === "true" &&
        (await this.policies.get(POLICY.adminMfaRequired)));

    if (mfaRequired && req.identity.aal !== "aal2") {
      throw new ForbiddenException({
        code: "MFA_REQUIRED",
        message: "Multi-factor authentication is required for this action",
      });
    }

    // Defence-in-depth: Supabase re-issues access tokens on refresh, so iat is
    // token issue time, not session start. Real admin session time-boxing is
    // configured in Supabase Auth settings — see docs/DEPLOYMENT.md.
    const maxAge = await this.policies.get(POLICY.adminSessionMaxAgeSeconds);
    const iat = req.identity.issuedAt;
    if (iat && Math.floor(Date.now() / 1000) - iat > maxAge) {
      throw new ForbiddenException({
        code: "SESSION_TOO_OLD",
        message: "Session is too old for this action — re-authenticate",
      });
    }
    return true;
  }
}
