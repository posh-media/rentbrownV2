/**
 * Shared Zod validation schemas — used by the API (request validation) and
 * client apps (form validation). Single source of truth for input contracts.
 */

import { z } from "zod";

export const currencySchema = z.enum(["NGN", "USD"]);
export const platformSchema = z.enum(["mobile", "web"]);

export const minorUnitsSchema = z
  .string()
  .regex(/^\d+$/, "amount must be a minor-unit string")
  .or(z.number().int().nonnegative().transform(String));

export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

// ── Auth / users ──────────────────────────────────────────────
export const signupSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(120),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "letters, numbers and underscore only"),
  referralCode: z.string().max(64).optional(),
  displayCurrency: currencySchema.default("NGN"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const notificationPrefsSchema = z
  .object({
    push: z.boolean().optional(),
    email: z.boolean().optional(),
    marketing: z.boolean().optional(),
    maturity: z.boolean().optional(),
    security: z.boolean().optional(),
  })
  .strict();

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  displayCurrency: currencySchema.optional(),
  timezone: z.string().min(1).max(64).optional(),
  notificationPrefs: notificationPrefsSchema.optional(),
  // accountCurrency is intentionally absent — fixed at provisioning
});

export const accountStatusSchema = z.enum(["ACTIVE", "RESTRICTED", "SUSPENDED", "CLOSED"]);

export const adminSetStatusSchema = z.object({
  status: accountStatusSchema,
  reason: z.string().min(3).max(500),
});

// mirrors ROLE_NAMES in @rentbrown/database — duplicated to keep this
// package dependency-free; the seed-drift test guards the names
export const roleNameSchema = z.enum([
  "investor",
  "support",
  "kyc_reviewer",
  "ops_admin",
  "finance_admin",
  "super_admin",
]);

export const assignRoleSchema = z.object({
  role: roleNameSchema,
});

export const recordConsentSchema = z.object({
  termsVersionId: z.string().uuid(),
});

export const adminUsersQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: accountStatusSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const adminAuditQuerySchema = z.object({
  targetType: z.string().max(64).optional(),
  targetId: z.string().max(128).optional(),
  actorId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const setPolicySchema = z.object({
  value: z.unknown(),
});

// ── PIN (RB-093 — web + mobile) ───────────────────────────────
export const pinSchema = z
  .string()
  .length(4, "PIN must be 4 digits")
  .regex(/^\d{4}$/);

export const setPinSchema = z.object({
  pin: pinSchema,
  currentPin: pinSchema.optional(),
});

// ── Financial intent schemas (validated server-side only) ─────
export const depositIntentSchema = z.object({
  amountMinor: minorUnitsSchema,
  currency: currencySchema,
  method: z.enum(["PAYSTACK", "KORAPAY"]),
  idempotencyKey: idempotencyKeySchema,
});

export const investQuoteSchema = z.object({
  roundId: z.string().uuid(),
  slotQuantity: z.number().int().min(1).max(100_000),
});

export const walletInvestSchema = investQuoteSchema.extend({
  idempotencyKey: idempotencyKeySchema,
});

export const directInvestSchema = investQuoteSchema.extend({
  method: z.enum(["PAYSTACK", "KORAPAY"]),
  idempotencyKey: idempotencyKeySchema,
});

export const withdrawalRequestSchema = z.object({
  amountMinor: minorUnitsSchema,
  currency: currencySchema,
  payoutMethodId: z.string().uuid(),
  pin: pinSchema,
  idempotencyKey: idempotencyKeySchema,
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;
export type AdminSetStatusInput = z.infer<typeof adminSetStatusSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;
export type SetPolicyInput = z.infer<typeof setPolicySchema>;
export type DepositIntentInput = z.infer<typeof depositIntentSchema>;
export type WalletInvestInput = z.infer<typeof walletInvestSchema>;
export type DirectInvestInput = z.infer<typeof directInvestSchema>;
export type WithdrawalRequestInput = z.infer<typeof withdrawalRequestSchema>;
