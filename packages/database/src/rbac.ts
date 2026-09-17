/**
 * RBAC constants — single source of truth for role and permission names.
 * Kept in sync with drizzle/0002_seed_rbac_policies_terms.sql; the seed-drift
 * test asserts every name below appears in the migration SQL.
 */

export const ROLE_NAMES = [
  "investor",
  "support",
  "kyc_reviewer",
  "ops_admin",
  "finance_admin",
  "super_admin",
] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export const PERMISSION_NAMES = [
  "users.read",
  "users.manage_status",
  "roles.read",
  "roles.assign",
  "audit.read",
  "kyc.read",
  "kyc.review",
  "kyc.documents.view",
  "policies.read",
  "policies.manage",
  "withdrawals.read",
  "withdrawals.initiate",
  "withdrawals.approve",
  "ledger.read",
  "catalogue.manage",
] as const;
export type PermissionName = (typeof PERMISSION_NAMES)[number];

/** permission bundles granted to each system role in the seed migration */
export const ROLE_PERMISSION_GRANTS: Record<RoleName, readonly PermissionName[] | "ALL"> = {
  investor: [],
  support: ["users.read", "kyc.read"],
  kyc_reviewer: ["users.read", "kyc.read", "kyc.review", "kyc.documents.view"],
  ops_admin: [
    "users.read",
    "users.manage_status",
    "roles.read",
    "audit.read",
    "kyc.read",
    "kyc.review",
    "kyc.documents.view",
    "policies.read",
    "withdrawals.read",
    "withdrawals.initiate",
    "catalogue.manage",
  ],
  finance_admin: [
    "users.read",
    "roles.read",
    "audit.read",
    "policies.read",
    "withdrawals.read",
    "withdrawals.approve",
    "ledger.read",
  ],
  super_admin: "ALL",
};
