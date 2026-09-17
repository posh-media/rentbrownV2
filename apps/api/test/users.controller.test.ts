import { describe, expect, it, vi } from "vitest";
import type { KycService } from "../src/modules/kyc/kyc.service.js";
import type { KycPolicyService } from "../src/modules/kyc/kyc-policy.service.js";
import type { LegalService } from "../src/modules/legal/legal.service.js";
import type { RolesService } from "../src/modules/rbac/roles.service.js";
import type { UsersService, InternalUser } from "../src/modules/users/users.service.js";
import { UsersController } from "../src/modules/users/users.controller.js";

const user = {
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
  notificationPrefs: {},
  createdAt: new Date(),
} as unknown as InternalUser;

function makeController(opts: { satisfied: boolean; canStart: boolean }) {
  const kyc = {
    summaryFor: vi.fn().mockResolvedValue({
      status: "NONE",
      tier: 0,
      canStart: opts.canStart,
      nextSteps: ["START_KYC"],
    }),
  } as unknown as KycService;
  const kycPolicy = {
    evaluate: vi.fn().mockResolvedValue({
      required: true,
      satisfied: opts.satisfied,
      requiredTier: 1,
      currentTier: opts.satisfied ? 1 : 0,
      policyKey: "kyc.withdrawal_gate",
    }),
  } as unknown as KycPolicyService;
  const ctrl = new UsersController(
    {} as UsersService,
    {
      rolesFor: vi.fn().mockResolvedValue(["investor"]),
      permissionsFor: vi.fn().mockResolvedValue(new Set(["x"])),
    } as unknown as RolesService,
    { pendingFor: vi.fn().mockResolvedValue([]) } as unknown as LegalService,
    kyc,
    kycPolicy,
  );
  return { ctrl, kyc, kycPolicy };
}

describe("GET /users/me — KYC wiring", () => {
  it("returns the KYC summary from KycService and gates withdrawal on the policy", async () => {
    const { ctrl, kyc, kycPolicy } = makeController({ satisfied: false, canStart: true });
    const me = await ctrl.me(user);
    expect(kyc.summaryFor).toHaveBeenCalledWith("u1");
    expect(kycPolicy.evaluate).toHaveBeenCalledWith("u1", "withdrawal");
    expect(me.kyc).toMatchObject({ status: "NONE", canStart: true });
    expect(me.capabilities.withdrawal).toEqual({ allowed: false, reason: "KYC_REQUIRED" });
    expect(me.capabilities["kyc.start"]).toEqual({ allowed: true });
  });

  it("reports NOT_AVAILABLE_YET once KYC is satisfied", async () => {
    const { ctrl } = makeController({ satisfied: true, canStart: false });
    const me = await ctrl.me(user);
    expect(me.capabilities.withdrawal).toEqual({ allowed: false, reason: "NOT_AVAILABLE_YET" });
    expect(me.capabilities["kyc.start"]).toEqual({ allowed: false });
  });
});
