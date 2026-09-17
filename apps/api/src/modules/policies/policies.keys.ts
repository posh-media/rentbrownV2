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
} as const satisfies Record<string, PolicySpec<unknown>>;

/** key → spec lookup for the admin PUT endpoint (unknown key → 404) */
export const POLICY_SPECS: Record<string, PolicySpec<unknown>> = Object.fromEntries(
  Object.values(POLICY).map((s) => [s.key, s]),
);
