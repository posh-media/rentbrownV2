import { describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { SupabaseAuthGuard } from "../src/common/guards/supabase-auth.guard.js";
import { PermissionsGuard } from "../src/common/guards/permissions.guard.js";
import type { SupabaseJwtVerifier } from "../src/common/supabase/jwt-verifier.js";
import type { UsersService } from "../src/modules/users/users.service.js";

function ctx(headers: Record<string, string>, identity?: unknown): ExecutionContext {
  const req = { headers, identity } as never;
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

const identity = { subject: "u1", email: "a@b.com", appMetadata: {}, userMetadata: {} };

describe("SupabaseAuthGuard", () => {
  it("rejects a request with no bearer token", async () => {
    const verifier = { verify: vi.fn() } as unknown as SupabaseJwtVerifier;
    const guard = new SupabaseAuthGuard(verifier);
    await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(ctx({ authorization: "Basic abc" }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("attaches the verified identity to the request", async () => {
    const verifier = {
      verify: vi.fn().mockResolvedValue(identity),
    } as unknown as SupabaseJwtVerifier;
    const guard = new SupabaseAuthGuard(verifier);
    const context = ctx({ authorization: "Bearer tok" });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    const req = context.switchToHttp().getRequest() as { identity: unknown };
    expect(req.identity).toEqual(identity);
  });
});

describe("PermissionsGuard", () => {
  function makeGuard(required: string[] | undefined, granted: Set<string>) {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(required),
    } as unknown as Reflector;
    const users = {
      findOrProvision: vi.fn().mockResolvedValue({ id: "u1" }),
      permissionsFor: vi.fn().mockResolvedValue(granted),
    } as unknown as UsersService;
    return new PermissionsGuard(reflector, users);
  }

  it("allows when no permissions are required", async () => {
    const guard = makeGuard(undefined, new Set());
    await expect(guard.canActivate(ctx({}, identity))).resolves.toBe(true);
  });

  it("rejects when identity is missing", async () => {
    const guard = makeGuard(["admin.read"], new Set(["admin.read"]));
    await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects when a required permission is missing", async () => {
    const guard = makeGuard(["withdrawal.approve"], new Set(["kyc.review"]));
    await expect(guard.canActivate(ctx({}, identity))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows when all required permissions are granted", async () => {
    const guard = makeGuard(
      ["kyc.review", "withdrawal.approve"],
      new Set(["kyc.review", "withdrawal.approve", "admin.read"]),
    );
    await expect(guard.canActivate(ctx({}, identity))).resolves.toBe(true);
  });
});
