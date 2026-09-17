import { z, type ZodSchema } from "zod";

/** a registered policy: storage key, value schema, and safe fallback */
export interface PolicySpec<T> {
  key: string;
  schema: ZodSchema<T>;
  fallback: T;
}

/**
 * Typed accessors for seeded policy keys. Consumers call
 * `policies.get(POLICY.x)` — never read system_policies directly.
 */
export const POLICY = {
  adminMfaRequired: {
    key: "admin.mfa_required",
    schema: z.boolean(),
    fallback: true,
  },
  adminSessionMaxAgeSeconds: {
    key: "admin.session_max_age_seconds",
    schema: z.number().int().positive(),
    fallback: 43_200,
  },
  kycWithdrawalGate: {
    key: "kyc.withdrawal_gate",
    schema: z.object({ enabled: z.boolean(), requiredTier: z.number().int().min(0) }),
    fallback: { enabled: true, requiredTier: 1 },
  },
  emailVerificationRequiredFor: {
    key: "identity.email_verification_required_for",
    schema: z.array(z.string()),
    fallback: [] as string[],
  },
  usernameChangeAllowed: {
    key: "identity.username_change_allowed",
    schema: z.boolean(),
    fallback: true,
  },
  kycTiers: {
    key: "kyc.tiers",
    schema: z.record(z.string(), z.object({ label: z.string(), checks: z.array(z.string()) })),
    fallback: {
      "1": { label: "Basic identity", checks: ["ID_VERIFICATION"] },
    } as Record<string, { label: string; checks: string[] }>,
  },
  kycAllowedIdTypes: {
    key: "kyc.allowed_id_types",
    schema: z.record(z.string(), z.array(z.string())),
    fallback: { NG: ["NIN", "BVN"] } as Record<string, string[]>,
  },
  kycDocumentMaxBytes: {
    key: "kyc.document_max_bytes",
    schema: z.number().int().positive(),
    fallback: 5_242_880,
  },
  kycDocumentAllowedTypes: {
    key: "kyc.document_allowed_types",
    schema: z.array(z.string()),
    fallback: ["image/jpeg", "image/png", "application/pdf"] as string[],
  },
  kycCaseExpiryDays: {
    key: "kyc.case_expiry_days",
    schema: z.number().int().positive(),
    fallback: 30,
  },
} as const satisfies Record<string, PolicySpec<unknown>>;

/** key → spec lookup for the admin PUT endpoint (unknown key → 404) */
export const POLICY_SPECS: Record<string, PolicySpec<unknown>> = Object.fromEntries(
  Object.values(POLICY).map((s) => [s.key, s]),
);
