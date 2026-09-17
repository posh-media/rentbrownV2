/**
 * RentBrown V2 — PostgreSQL schema foundation (Drizzle).
 * Mirrors docs/FINANCIAL_MODEL.md and master-doc §39.
 *
 * Conventions:
 * - ids: uuid v4 default gen_random_uuid()
 * - money: bigint minor units — NEVER numeric/float
 * - roi: integer basis points (5000 = 50%)
 * - timestamps: timestamptz UTC, server-set defaults
 * - financial tables are append-only: no update/delete granted at role level
 * - counters guarded by CHECK constraints (DB backstops the invariants)
 */

import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Enums ─────────────────────────────────────────────────────
export const currencyEnum = pgEnum("currency_code", ["NGN", "USD"]);
export const durationUnitEnum = pgEnum("duration_unit", [
  "HOURS",
  "DAYS",
  "WEEKS",
  "MONTHS",
  "YEARS",
]);
export const walletAccountTypeEnum = pgEnum("wallet_account_type", [
  "AVAILABLE",
  "RESERVED",
  "BONUS",
  "BONUS_PENDING",
]);
export const ledgerDirectionEnum = pgEnum("ledger_direction", ["DEBIT", "CREDIT"]);
export const roundStatusEnum = pgEnum("round_status", [
  "DRAFT",
  "SCHEDULED",
  "OPEN",
  "CLOSED_TO_NEW",
  "SETTLING",
  "SETTLED",
  "ARCHIVED",
  "CANCELLED",
]);
export const investmentStatusEnum = pgEnum("investment_status", [
  "CHECKOUT_INITIATED",
  "PAYMENT_PENDING",
  "PAYMENT_EXPIRED",
  "PAYMENT_VERIFIED",
  "ACTIVE",
  "MATURITY_DUE",
  "SETTLEMENT_PENDING",
  "COMPLETED",
  "REFUND_INITIATED",
  "REFUNDED",
  "REFUND_FAILED",
  "OPS_ESCALATED",
  "REVIEW_REQUIRED",
  "FAILED",
]);
export const withdrawalStatusEnum = pgEnum("withdrawal_status", [
  "REQUESTED",
  "FUNDS_RESERVED",
  "PENDING_MANUAL_PAYOUT",
  "COMPLETED",
  "REJECTED",
  "REJECTED_RELEASED",
  "FAILED_RELEASED",
]);
export const platformEnum = pgEnum("platform_name", ["mobile", "web"]);

// ── Identity & RBAC ───────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalSubject: varchar("external_subject", { length: 255 }).notNull(), // Supabase sub
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 32 }),
    displayName: varchar("display_name", { length: 120 }),
    username: varchar("username", { length: 30 }),
    referralCode: varchar("referral_code", { length: 64 }),
    accountCurrency: currencyEnum("account_currency").notNull().default("NGN"),
    displayCurrency: currencyEnum("display_currency").notNull().default("NGN"),
    accountStatus: varchar("account_status", { length: 32 }).notNull().default("ACTIVE"),
    pinHash: text("pin_hash"), // argon2/bcrypt — never plaintext
    pinSetAt: timestamp("pin_set_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_external_subject_uq").on(t.externalSubject),
    uniqueIndex("users_email_uq").on(t.email),
    uniqueIndex("users_username_uq").on(t.username),
    uniqueIndex("users_referral_code_uq").on(t.referralCode),
    index("users_status_idx").on(t.accountStatus),
  ],
);

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  description: text("description"),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull().unique(), // e.g. "withdrawal.approve"
  description: text("description"),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id),
  },
  (t) => [uniqueIndex("role_permissions_uq").on(t.roleId, t.permissionId)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    assignedBy: uuid("assigned_by"),
  },
  (t) => [uniqueIndex("user_roles_uq").on(t.userId, t.roleId)],
);

// ── Property catalogue ────────────────────────────────────────
export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 160 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    summary: text("summary"),
    details: text("details"),
    category: varchar("category", { length: 64 }),
    locationPublic: varchar("location_public", { length: 255 }),
    heroImageUrl: text("hero_image_url"),
    businessInfo: jsonb("business_info"),
    version: integer("version").notNull().default(1),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("properties_slug_uq").on(t.slug),
    index("properties_status_idx").on(t.status, t.publishedAt),
  ],
);

export const propertyDocuments = pgTable(
  "property_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    type: varchar("type", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }),
    storageKey: text("storage_key").notNull(),
    sha256: varchar("sha256", { length: 64 }),
    reviewStatus: varchar("review_status", { length: 32 }).notNull().default("PENDING"),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("property_documents_property_idx").on(t.propertyId, t.reviewStatus)],
);

// ── Investment plans & rounds ─────────────────────────────────
export const investmentPlans = pgTable(
  "investment_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    name: varchar("name", { length: 160 }).notNull(),
    currency: currencyEnum("currency").notNull(),
    slotPriceMinor: bigint("slot_price_minor", { mode: "bigint" }).notNull(),
    roiBps: integer("roi_bps").notNull(),
    durationValue: integer("duration_value").notNull(),
    durationUnit: durationUnitEnum("duration_unit").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("plans_slot_price_pos", sql`slot_price_minor > 0`),
    check("plans_roi_nonneg", sql`roi_bps >= 0`),
    check("plans_duration_pos", sql`duration_value > 0`),
    index("plans_property_idx").on(t.propertyId, t.status),
  ],
);

export const investmentRounds = pgTable(
  "investment_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => investmentPlans.id),
    totalSlots: integer("total_slots").notNull(),
    availableSlots: integer("available_slots").notNull(),
    allocatedSlots: integer("allocated_slots").notNull().default(0),
    perUserMaxSlots: integer("per_user_max_slots"),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    status: roundStatusEnum("status").notNull().default("DRAFT"),
    version: integer("version").notNull().default(1), // optimistic concurrency
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("rounds_total_pos", sql`total_slots > 0`),
    check("rounds_available_nonneg", sql`available_slots >= 0`),
    check("rounds_allocated_nonneg", sql`allocated_slots >= 0`),
    check("rounds_capacity_bound", sql`available_slots + allocated_slots <= total_slots`),
    check("rounds_per_user_max_pos", sql`per_user_max_slots IS NULL OR per_user_max_slots > 0`),
    index("rounds_status_idx").on(t.status, t.opensAt, t.closesAt),
    index("rounds_plan_idx").on(t.planId),
  ],
);

// ── Investments (immutable economics snapshots) ───────────────
export const investments = pgTable(
  "investments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    roundId: uuid("round_id")
      .notNull()
      .references(() => investmentRounds.id),
    planId: uuid("plan_id")
      .notNull()
      .references(() => investmentPlans.id),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    status: investmentStatusEnum("status").notNull(),
    currency: currencyEnum("currency").notNull(),
    // snapshots — never re-read live plan economics
    slotQuantity: integer("slot_quantity").notNull(),
    slotPriceMinor: bigint("slot_price_minor", { mode: "bigint" }).notNull(),
    principalMinor: bigint("principal_minor", { mode: "bigint" }).notNull(),
    roiBps: integer("roi_bps").notNull(),
    durationValue: integer("duration_value").notNull(),
    durationUnit: durationUnitEnum("duration_unit").notNull(),
    expectedProfitMinor: bigint("expected_profit_minor", { mode: "bigint" }).notNull(),
    expectedMaturityMinor: bigint("expected_maturity_minor", { mode: "bigint" }).notNull(),
    fundingType: varchar("funding_type", { length: 16 }).notNull(), // WALLET | DIRECT
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    maturesAt: timestamp("matures_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("inv_qty_pos", sql`slot_quantity > 0`),
    check("inv_amounts_nonneg", sql`principal_minor >= 0 AND expected_profit_minor >= 0`),
    index("inv_user_status_idx").on(t.userId, t.status, t.createdAt),
    index("inv_matures_idx").on(t.status, t.maturesAt),
    index("inv_round_idx").on(t.roundId),
    uniqueIndex("inv_idem_uq").on(t.userId, t.idempotencyKey),
  ],
);

// ── Wallet & ledger ───────────────────────────────────────────
export const walletAccounts = pgTable(
  "wallet_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    currency: currencyEnum("currency").notNull(),
    type: walletAccountTypeEnum("type").notNull(),
    balanceMinor: bigint("balance_minor", { mode: "bigint" })
      .notNull()
      .default(sql`0`), // raw SQL default — bigint literals break drizzle-kit snapshots
    version: integer("version").notNull().default(1),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("wallet_uq").on(t.userId, t.currency, t.type),
    check("wallet_nonneg", sql`balance_minor >= 0`),
  ],
);

export const ledgerTransactions = pgTable(
  "ledger_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: varchar("type", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("POSTED"),
    currency: currencyEnum("currency").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    actorId: uuid("actor_id"),
    subjectId: uuid("subject_id"),
    investmentId: uuid("investment_id"),
    depositId: uuid("deposit_id"),
    withdrawalId: uuid("withdrawal_id"),
    rewardGrantId: uuid("reward_grant_id"),
    provider: varchar("provider", { length: 64 }),
    providerRef: varchar("provider_ref", { length: 255 }),
    reversalOf: uuid("reversal_of"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata"),
  },
  (t) => [
    uniqueIndex("ledger_txn_idem_uq").on(t.type, t.idempotencyKey),
    index("ledger_txn_subject_idx").on(t.subjectId, t.postedAt),
    index("ledger_txn_type_idx").on(t.type, t.postedAt),
  ],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => ledgerTransactions.id),
    accountId: uuid("account_id").notNull(), // wallet_accounts.id or platform account id
    direction: ledgerDirectionEnum("direction").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: currencyEnum("currency").notNull(),
    balanceAfterMinor: bigint("balance_after_minor", { mode: "bigint" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("entry_amount_pos", sql`amount_minor > 0`),
    index("entries_txn_idx").on(t.transactionId),
    index("entries_account_idx").on(t.accountId, t.createdAt),
  ],
);

// Platform accounts (clearing, liability, revenue…) — not user-owned
export const platformAccounts = pgTable(
  "platform_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 64 }).notNull(), // e.g. INVESTMENT_LIABILITY:NGN
    currency: currencyEnum("currency").notNull(),
    description: text("description"),
    balanceMinor: bigint("balance_minor", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("platform_accounts_code_uq").on(t.code, t.currency)],
);

// ── Deposits & payment intents ────────────────────────────────
export const depositIntents = pgTable(
  "deposit_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    provider: varchar("provider", { length: 32 }).notNull(), // PAYSTACK | KORAPAY
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: currencyEnum("currency").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("INTENT_CREATED"),
    providerRef: varchar("provider_ref", { length: 255 }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("deposit_provider_ref_uq").on(t.provider, t.providerRef),
    uniqueIndex("deposit_idem_uq").on(t.userId, t.idempotencyKey),
    index("deposit_user_idx").on(t.userId, t.createdAt),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerEventId: varchar("provider_event_id", { length: 255 }).notNull(),
    eventType: varchar("event_type", { length: 128 }),
    payloadHash: varchar("payload_hash", { length: 64 }),
    status: varchar("status", { length: 32 }).notNull().default("RECEIVED"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("webhook_uq").on(t.provider, t.providerEventId)],
);

// ── Withdrawals & payout methods ──────────────────────────────
export const payoutMethods = pgTable(
  "payout_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 32 }).notNull().default("BANK"),
    bankCode: varchar("bank_code", { length: 16 }),
    accountNumberMasked: varchar("account_number_masked", { length: 20 }),
    accountName: varchar("account_name", { length: 255 }),
    currency: currencyEnum("currency").notNull().default("NGN"),
    verified: boolean("verified").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payout_methods_user_idx").on(t.userId, t.verified)],
);

export const withdrawals = pgTable(
  "withdrawals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    payoutMethodId: uuid("payout_method_id").references(() => payoutMethods.id),
    currency: currencyEnum("currency").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    feeMinor: bigint("fee_minor", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    netPayoutMinor: bigint("net_payout_minor", { mode: "bigint" }),
    status: withdrawalStatusEnum("status").notNull().default("REQUESTED"),
    reviewReason: text("review_reason"),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    paymentReference: varchar("payment_reference", { length: 255 }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("withdrawal_idem_uq").on(t.userId, t.idempotencyKey),
    index("withdrawal_status_idx").on(t.status, t.createdAt),
    index("withdrawal_user_idx").on(t.userId, t.createdAt),
  ],
);

// ── KYC ───────────────────────────────────────────────────────
export const kycCases = pgTable(
  "kyc_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    provider: varchar("provider", { length: 32 }).notNull().default("SMILE_IDENTITY"),
    requestedTier: integer("requested_tier").notNull().default(1),
    currentTier: integer("current_tier").notNull().default(0),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    reasonCodes: jsonb("reason_codes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("kyc_user_status_idx").on(t.userId, t.status)],
);

export const kycChecks = pgTable("kyc_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => kycCases.id),
  providerJobId: varchar("provider_job_id", { length: 255 }),
  checkType: varchar("check_type", { length: 64 }),
  result: varchar("result", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kycDocuments = pgTable("kyc_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => kycCases.id),
  docType: varchar("doc_type", { length: 64 }).notNull(),
  storageKey: text("storage_key"), // private bucket — never a public URL
  providerToken: varchar("provider_token", { length: 255 }),
  retentionStatus: varchar("retention_status", { length: 32 }).default("RETAINED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kycDecisions = pgTable("kyc_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => kycCases.id),
  reviewerId: uuid("reviewer_id"),
  decision: varchar("decision", { length: 32 }).notNull(),
  reason: text("reason"),
  policyVersion: varchar("policy_version", { length: 32 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Referrals & rewards ───────────────────────────────────────
export const referralAttributions = pgTable(
  "referral_attributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerId: uuid("referrer_id")
      .notNull()
      .references(() => users.id),
    referredUserId: uuid("referred_user_id")
      .notNull()
      .references(() => users.id),
    codeSnapshot: varchar("code_snapshot", { length: 64 }).notNull(),
    campaign: varchar("campaign", { length: 64 }),
    attributedAt: timestamp("attributed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("referral_referred_uq").on(t.referredUserId),
    index("referral_referrer_idx").on(t.referrerId),
  ],
);

export const rewardGrants = pgTable(
  "reward_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerId: uuid("referrer_id")
      .notNull()
      .references(() => users.id),
    referredUserId: uuid("referred_user_id")
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 32 }).notNull(), // SIGNUP | DEPOSIT_PERCENT
    status: varchar("status", { length: 32 }).notNull().default("PENDING"),
    // NGN-valued source of truth (RB-076)
    sourceAmountMinor: bigint("source_amount_minor", { mode: "bigint" }).notNull(),
    sourceCurrency: currencyEnum("source_currency").notNull().default("NGN"),
    fxRate: text("fx_rate"), // decimal string snapshot
    fxRateAt: timestamp("fx_rate_at", { withTimezone: true }),
    creditedAmountMinor: bigint("credited_amount_minor", { mode: "bigint" }),
    targetCurrency: currencyEnum("target_currency"),
    triggeringDepositId: uuid("triggering_deposit_id"),
    qualifyingDepositMinor: bigint("qualifying_deposit_minor", { mode: "bigint" }),
    creditedAt: timestamp("credited_at", { withTimezone: true }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reward_referrer_idx").on(t.referrerId, t.status),
    index("reward_referred_idx").on(t.referredUserId),
  ],
);

// ── Notifications & outbox ────────────────────────────────────
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    category: varchar("category", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    deepLink: text("deep_link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt, t.createdAt)],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aggregateType: varchar("aggregate_type", { length: 64 }).notNull(),
    aggregateId: uuid("aggregate_id"),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [index("outbox_pending_idx").on(t.status, t.nextAttemptAt)],
);

// ── Audit, idempotency, policies, FX ──────────────────────────
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id"),
    actorType: varchar("actor_type", { length: 32 }).notNull().default("USER"),
    action: varchar("action", { length: 128 }).notNull(),
    targetType: varchar("target_type", { length: 64 }),
    targetId: varchar("target_id", { length: 128 }),
    requestId: varchar("request_id", { length: 64 }),
    diffRedacted: jsonb("diff_redacted"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_target_idx").on(t.targetType, t.targetId, t.createdAt),
    index("audit_actor_idx").on(t.actorId, t.createdAt),
  ],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: varchar("key", { length: 128 }).notNull(),
    userId: uuid("user_id").notNull(),
    scope: varchar("scope", { length: 64 }).notNull(),
    requestHash: varchar("request_hash", { length: 64 }),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("idem_uq").on(t.userId, t.scope, t.key)],
);

export const termsVersions = pgTable("terms_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  docType: varchar("doc_type", { length: 64 }).notNull(),
  version: varchar("version", { length: 32 }).notNull(),
  sha256: varchar("sha256", { length: 64 }),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userConsents = pgTable(
  "user_consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    termsVersionId: uuid("terms_version_id")
      .notNull()
      .references(() => termsVersions.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: varchar("ip_address", { length: 64 }),
  },
  (t) => [uniqueIndex("consent_uq").on(t.userId, t.termsVersionId)],
);

export const fxRates = pgTable(
  "fx_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    base: currencyEnum("base").notNull(),
    quote: currencyEnum("quote").notNull(),
    rate: text("rate").notNull(), // decimal string — display + referral conversion only
    source: varchar("source", { length: 64 }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("fx_pair_idx").on(t.base, t.quote, t.fetchedAt)],
);

export const systemPolicies = pgTable("system_policies", {
  key: varchar("key", { length: 128 }).primaryKey(), // e.g. "withdrawal.fee"
  value: jsonb("value").notNull(),
  version: integer("version").notNull().default(1),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
