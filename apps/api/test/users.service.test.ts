import { describe, expect, it, vi } from "vitest";
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { updateProfileSchema } from "@rentbrown/validation";
import type { AppConfigService } from "../src/config/config.service.js";
import type { AuditService } from "../src/modules/audit/audit.service.js";
import type { PoliciesService } from "../src/modules/policies/policies.service.js";
import type { RolesService } from "../src/modules/rbac/roles.service.js";
import { UsersService } from "../src/modules/users/users.service.js";
import { fakeDb } from "./fake-db.js";

const baseUser = {
  id: "u1",
  externalSubject: "sub-1",
  email: "a@b.com",
  displayName: "Ada",
  firstName: null,
  lastName: null,
  username: "ada",
  referralCode: "ada",
  accountCurrency: "NGN",
  displayCurrency: "NGN",
  accountStatus: "ACTIVE",
  emailVerifiedAt: null,
  lastSeenAt: null,
  deletedAt: null,
  notificationPrefs: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const identity = {
  subject: "sub-1",
  email: "a@b.com",
  appMetadata: {},
  userMetadata: { username: "ada" },
};

function makeService(db: unknown, opts: { bootstrapEmails?: string } = {}) {
  const config = {
    get: (k: string) => ({ BOOTSTRAP_SUPER_ADMIN_EMAILS: opts.bootstrapEmails ?? "" })[k],
  } as unknown as AppConfigService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const policies = {
    get: vi.fn(async (spec: { fallback: unknown }) => spec.fallback),
  } as unknown as PoliciesService;
  const roles = {
    grantSystem: vi.fn().mockResolvedValue(undefined),
    permissionsFor: vi.fn().mockResolvedValue(new Set()),
  } as unknown as RolesService;
  return {
    svc: new UsersService(db as never, config, audit, policies, roles),
    audit,
    policies,
    roles,
  };
}

describe("UsersService.findOrProvision", () => {
  it("provisions a new user and assigns the investor role", async () => {
    const created = { ...baseUser };
    // select → no existing user; referral-code clash check → none; insert → row
    const db = fakeDb([[], [], [created]]);
    const { svc, roles } = makeService(db);
    const user = await svc.findOrProvision(identity as never);
    expect(user.id).toBe("u1");
    expect(roles.grantSystem).toHaveBeenCalledWith("u1", "investor", undefined, expect.anything());
  });

  it("grants super_admin + audit when the email is in BOOTSTRAP_SUPER_ADMIN_EMAILS", async () => {
    const db = fakeDb([[], [], [{ ...baseUser }]]);
    const { svc, roles, audit } = makeService(db, { bootstrapEmails: "A@B.com, other@x.com" });
    await svc.findOrProvision(identity as never);
    expect(roles.grantSystem).toHaveBeenCalledWith(
      "u1",
      "super_admin",
      undefined,
      expect.anything(),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "rbac.bootstrap_super_admin", actorType: "SYSTEM" }),
    );
  });

  it("syncs email and sets emailVerifiedAt for an existing user", async () => {
    const stale = { ...baseUser, email: "old@b.com" };
    const db = fakeDb([[stale], []]); // select → user; sync update
    const { svc } = makeService(db);
    const user = await svc.findOrProvision({
      ...identity,
      email: "a@b.com",
      emailVerified: true,
    } as never);
    expect(user.email).toBe("a@b.com");
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(user.lastSeenAt).toBeInstanceOf(Date);
  });

  it("drops a conflicting email on sync (23505) instead of 500ing", async () => {
    const held = { ...baseUser, email: "old@b.com" };
    // select → user; update → 23505 (email held by another user); retry → ok
    const db = fakeDb([[held], Object.assign(new Error("dup"), { code: "23505" }), []]);
    const { svc } = makeService(db);
    const user = await svc.findOrProvision({ ...identity, email: "taken@x.com" } as never);
    expect(user.email).toBe("old@b.com");
    expect(user.lastSeenAt).toBeInstanceOf(Date);
  });

  it("re-selects on a provisioning unique-violation race", async () => {
    const winner = { ...baseUser };
    const db = fakeDb([[], [], Object.assign(new Error("dup"), { code: "23505" }), [winner]]);
    const { svc } = makeService(db);
    const user = await svc.findOrProvision(identity as never);
    expect(user.id).toBe("u1");
  });
});

describe("updateProfileSchema", () => {
  it("does not accept accountCurrency — it is fixed at provisioning", () => {
    const parsed = updateProfileSchema.safeParse({ accountCurrency: "USD" });
    // non-strict object strips unknown keys; the field must not survive
    expect(parsed.success).toBe(true);
    expect("accountCurrency" in (parsed.data ?? {})).toBe(false);
  });
});

describe("UsersService.updateProfile", () => {
  it("maps a username unique violation to USERNAME_TAKEN", async () => {
    const db = fakeDb([[{ ...baseUser }], Object.assign(new Error("dup"), { code: "23505" })]);
    const { svc } = makeService(db);
    await expect(svc.updateProfile("u1", { username: "taken_name" })).rejects.toMatchObject({
      response: { code: "USERNAME_TAKEN" },
    });
  });

  it("rejects an invalid timezone", async () => {
    const db = fakeDb([[{ ...baseUser }]]);
    const { svc } = makeService(db);
    await expect(svc.updateProfile("u1", { timezone: "Not/AZone" })).rejects.toMatchObject({
      response: { code: "INVALID_TIMEZONE" },
    });
  });

  it("blocks username changes when the policy disables them", async () => {
    const db = fakeDb([[{ ...baseUser }]]);
    const { svc, policies } = makeService(db);
    (policies.get as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await expect(svc.updateProfile("u1", { username: "new_name" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("writes an audit event listing only changed field names", async () => {
    const db = fakeDb([[{ ...baseUser }], [{ ...baseUser, firstName: "Adaeze" }]]);
    const { svc, audit } = makeService(db);
    await svc.updateProfile("u1", { firstName: "Adaeze" });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.profile_updated",
        diffRedacted: ["firstName"],
      }),
    );
  });
});

describe("UsersService.setAccountStatus", () => {
  function svcFor(status: string) {
    const db = fakeDb([[{ ...baseUser, accountStatus: status }], [{ ...baseUser }]]);
    const { svc, audit } = makeService(db);
    return { svc, audit };
  }

  it.each([
    ["ACTIVE", "RESTRICTED"],
    ["ACTIVE", "SUSPENDED"],
    ["RESTRICTED", "ACTIVE"],
    ["SUSPENDED", "ACTIVE"],
    ["SUSPENDED", "CLOSED"],
  ])("allows %s → %s", async (from, to) => {
    const { svc } = svcFor(from);
    await expect(
      svc.setAccountStatus("u1", to as never, "reason here", "admin-1"),
    ).resolves.toBeDefined();
  });

  it.each([
    ["CLOSED", "ACTIVE"],
    ["ACTIVE", "ACTIVE"],
    ["CLOSED", "SUSPENDED"],
  ])("rejects %s → %s as INVALID_STATUS_TRANSITION", async (from, to) => {
    const { svc } = svcFor(from);
    await expect(
      svc.setAccountStatus("u1", to as never, "reason here", "admin-1"),
    ).rejects.toMatchObject({ response: { code: "INVALID_STATUS_TRANSITION" } });
  });

  it("forbids changing your own status", async () => {
    const { svc } = svcFor("ACTIVE");
    await expect(
      svc.setAccountStatus("u1", "SUSPENDED", "reason here", "u1"),
    ).rejects.toMatchObject({ response: { code: "SELF_ACTION_FORBIDDEN" } });
  });

  it("404s on an unknown user", async () => {
    const db = fakeDb([[]]);
    const { svc } = makeService(db);
    await expect(
      svc.setAccountStatus("nope", "SUSPENDED", "reason here", "admin-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
