import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@rentbrown/database";
import type { KycGateDto } from "@rentbrown/types";
import { DB } from "../../database/database.module.js";
import { POLICY } from "../policies/policies.keys.js";
import { PoliciesService } from "../policies/policies.service.js";

const { kycCases } = schema;

/**
 * KYC capability gates — all thresholds come from system_policies via
 * PoliciesService; nothing is hardcoded here.
 */
@Injectable()
export class KycPolicyService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly policies: PoliciesService,
  ) {}

  async evaluate(userId: string, _action: "withdrawal"): Promise<KycGateDto> {
    const gate = await this.policies.get(POLICY.kycWithdrawalGate);
    const approved = await this.db
      .select({ tier: kycCases.currentTier })
      .from(kycCases)
      .where(and(eq(kycCases.userId, userId), eq(kycCases.status, "APPROVED")));
    const currentTier = approved.reduce((m, c) => Math.max(m, c.tier), 0);
    return {
      required: gate.enabled,
      satisfied: !gate.enabled || currentTier >= gate.requiredTier,
      requiredTier: gate.requiredTier,
      currentTier,
      policyKey: POLICY.kycWithdrawalGate.key,
    };
  }
}
