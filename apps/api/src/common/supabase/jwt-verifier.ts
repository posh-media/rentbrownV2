import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { createSecretKey } from "node:crypto";
import { AppConfigService } from "../../config/config.service.js";

export interface SupabaseIdentity {
  /** Supabase auth user id (sub) */
  subject: string;
  email?: string;
  role?: string;
  appMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
}

/**
 * Supabase JWT verifier — RS/ES keys via the project's JWKS endpoint
 * (`/auth/v1/.well-known/jwks.json`); HS256 legacy-secret fallback for
 * older projects. Issuer and audience are enforced.
 */
@Injectable()
export class SupabaseJwtVerifier {
  private readonly jwks;
  private readonly issuer: string;
  private readonly legacySecret?: ReturnType<typeof createSecretKey>;

  constructor(config: AppConfigService) {
    const base = config.get("SUPABASE_URL").replace(/\/$/, "");
    this.issuer = `${base}/auth/v1`;
    this.jwks = createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`), {
      cacheMaxAge: 10 * 60 * 1000,
    });
    const secret = config.get("SUPABASE_JWT_SECRET");
    if (secret) this.legacySecret = createSecretKey(Buffer.from(secret, "utf-8"));
  }

  async verify(token: string): Promise<SupabaseIdentity> {
    const options = { issuer: this.issuer, audience: "authenticated" };
    let payload: JWTPayload;
    try {
      payload = (await jwtVerify(token, this.jwks, options)).payload;
    } catch {
      if (!this.legacySecret) {
        throw new UnauthorizedException("Invalid or expired token");
      }
      try {
        payload = (await jwtVerify(token, this.legacySecret, { ...options, algorithms: ["HS256"] }))
          .payload;
      } catch {
        throw new UnauthorizedException("Invalid or expired token");
      }
    }
    if (!payload.sub) throw new UnauthorizedException("Token missing subject");
    return {
      subject: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
      appMetadata: (payload.app_metadata as Record<string, unknown>) ?? {},
      userMetadata: (payload.user_metadata as Record<string, unknown>) ?? {},
    };
  }
}
