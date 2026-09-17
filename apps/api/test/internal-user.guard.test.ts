import { describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import { InternalUserGuard } from "../src/common/guards/internal-user.guard.js";
import type { UsersService } from "../src/modules/users/users.service.js";

const identity = { subject: "sub-1", email: "a@b.com", appMetadata: {}, userMetadata: {} };

function ctx(user?: unknown): { context: ExecutionContext; req: Record<string, unknown> } {
  const req: Record<string, unknown> = { headers: {}, identity };
  if (user) req.user = user;
  return {
    req,
    context: {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext,
  };
}

function guardWith(user: unknown) {
  const users = { findOrProvision: vi.fn().mockResolvedValue(user) } as unknown as UsersService;
  return new InternalUserGuard(users);
}

describe("InternalUserGuard", () => {
  it("provisions and attaches the internal user", async () => {
    const user = { id: "u1", accountStatus: "ACTIVE", deletedAt: null };
    const { context, req } = ctx();
    await expect(guardWith(user).canActivate(context)).resolves.toBe(true);
    expect(req.user).toEqual(user);
  });

  it("rejects SUSPENDED accounts", async () => {
    const guard = guardWith({ id: "u1", accountStatus: "SUSPENDED", deletedAt: null });
    await expect(guard.canActivate(ctx().context)).rejects.toMatchObject({
      response: { code: "ACCOUNT_DISABLED" },
    });
    await expect(guard.canActivate(ctx().context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects CLOSED and soft-deleted accounts", async () => {
    const closed = guardWith({ id: "u1", accountStatus: "CLOSED", deletedAt: new Date() });
    await expect(closed.canActivate(ctx().context)).rejects.toMatchObject({
      response: { code: "ACCOUNT_DISABLED" },
    });
    const deleted = guardWith({ id: "u1", accountStatus: "ACTIVE", deletedAt: new Date() });
    await expect(deleted.canActivate(ctx().context)).rejects.toMatchObject({
      response: { code: "ACCOUNT_DISABLED" },
    });
  });

  it("lets RESTRICTED accounts through — capabilities are enforced downstream", async () => {
    const guard = guardWith({ id: "u1", accountStatus: "RESTRICTED", deletedAt: null });
    await expect(guard.canActivate(ctx().context)).resolves.toBe(true);
  });
});
