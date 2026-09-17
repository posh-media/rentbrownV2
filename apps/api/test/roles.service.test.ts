import { describe, expect, it, vi } from "vitest";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuditService } from "../src/modules/audit/audit.service.js";
import { RolesService } from "../src/modules/rbac/roles.service.js";
import { fakeDb } from "./fake-db.js";

const superRole = { id: "r-super", name: "super_admin", isSystem: true };
const supportRole = { id: "r-support", name: "support", isSystem: true };

function makeService(results: unknown[] = []) {
  const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  return { svc: new RolesService(fakeDb(results) as never, audit), audit };
}

describe("RolesService.assign", () => {
  it("assigns a role and audits", async () => {
    // roleByName → role; insert user_roles (bare await)
    const { svc, audit } = makeService([[supportRole], [{ id: "target-1" }], []]);
    await svc.assign("target-1", "support", "admin-1");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "rbac.role_assigned",
        targetId: "target-1",
        diffRedacted: { role: "support" },
      }),
    );
  });

  it("requires the actor to hold super_admin when granting super_admin", async () => {
    // roleByName → super role; rolesFor(actor) → ["ops_admin"]
    const { svc } = makeService([[superRole], [{ id: "target-1" }], [{ name: "ops_admin" }]]);
    await expect(svc.assign("target-1", "super_admin", "admin-1")).rejects.toMatchObject({
      response: { code: "INSUFFICIENT_ROLE" },
    });
  });

  it("lets a super_admin grant super_admin", async () => {
    const { svc } = makeService([[superRole], [{ id: "target-1" }], [{ name: "super_admin" }], []]);
    await expect(svc.assign("target-1", "super_admin", "admin-1")).resolves.toBeUndefined();
  });

  it("forbids self-assignment", async () => {
    const { svc } = makeService();
    await expect(svc.assign("u1", "support", "u1")).rejects.toMatchObject({
      response: { code: "SELF_ACTION_FORBIDDEN" },
    });
  });

  it("404s on an unknown role", async () => {
    const { svc } = makeService([[]]);
    await expect(svc.assign("target-1", "support", "admin-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe("RolesService.revoke", () => {
  it("forbids revoking the investor role", async () => {
    const { svc } = makeService();
    await expect(svc.revoke("target-1", "investor", "admin-1")).rejects.toMatchObject({
      response: { code: "ROLE_IMMUTABLE" },
    });
  });

  it("forbids self-revocation", async () => {
    const { svc } = makeService();
    await expect(svc.revoke("u1", "support", "u1")).rejects.toMatchObject({
      response: { code: "SELF_ACTION_FORBIDDEN" },
    });
  });

  it("revokes and audits", async () => {
    // roleByName → role; delete (bare await)
    const { svc, audit } = makeService([[supportRole], [{ id: "target-1" }], []]);
    await svc.revoke("target-1", "support", "admin-1");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "rbac.role_revoked", targetId: "target-1" }),
    );
  });
});
