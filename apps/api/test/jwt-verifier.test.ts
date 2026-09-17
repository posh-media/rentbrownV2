import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { UnauthorizedException } from "@nestjs/common";
import { SupabaseJwtVerifier } from "../src/common/supabase/jwt-verifier.js";
import type { AppConfigService } from "../src/config/config.service.js";

const SUPABASE_URL = "https://project.supabase.co";
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const SECRET = "test-jwt-secret-that-is-long-enough-for-hs256";

function config(): AppConfigService {
  return {
    get: (key: string) => ({ SUPABASE_URL, SUPABASE_JWT_SECRET: SECRET })[key] as never,
  } as unknown as AppConfigService;
}

async function sign(
  payload: Record<string, unknown>,
  opts: { issuer?: string; audience?: string; expiresIn?: string } = {},
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(opts.audience ?? "authenticated")
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? "1h")
    .sign(new TextEncoder().encode(SECRET));
}

describe("SupabaseJwtVerifier", () => {
  it("verifies a Supabase-shaped HS256 token and extracts identity", async () => {
    const verifier = new SupabaseJwtVerifier(config());
    const token = await sign({
      sub: "user-123",
      email: "a@b.com",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { username: "ada" },
    });
    const identity = await verifier.verify(token);
    expect(identity.subject).toBe("user-123");
    expect(identity.email).toBe("a@b.com");
    expect(identity.userMetadata.username).toBe("ada");
  });

  it("rejects a token with the wrong issuer", async () => {
    const verifier = new SupabaseJwtVerifier(config());
    const token = await sign({ sub: "user-123" }, { issuer: "https://evil.example" });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects an expired token", async () => {
    const verifier = new SupabaseJwtVerifier(config());
    const token = await sign({ sub: "user-123" }, { expiresIn: "-1s" });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a token with no subject", async () => {
    const verifier = new SupabaseJwtVerifier(config());
    const token = await sign({ email: "a@b.com" });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects garbage input", async () => {
    const verifier = new SupabaseJwtVerifier(config());
    await expect(verifier.verify("not-a-jwt")).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
