-- Seed: system roles, permissions, role→permission grants, system policies,
-- and DEVELOPMENT-PLACEHOLDER terms documents. Idempotent — safe to re-run.
-- Keep in sync with packages/database/src/rbac.ts (guarded by a drift test).

--> statement-breakpoint
-- ── Roles ────────────────────────────────────────────────────
INSERT INTO "roles" ("name", "description", "is_system") VALUES
  ('investor', 'Default role for every provisioned user', true),
  ('support', 'Read-only support access to users and KYC status', true),
  ('kyc_reviewer', 'Reviews KYC cases and documents', true),
  ('ops_admin', 'Operations administration — users, KYC, catalogue', true),
  ('finance_admin', 'Finance administration — withdrawals approval, ledger', true),
  ('super_admin', 'Full administrative access', true)
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
-- ── Permissions ──────────────────────────────────────────────
INSERT INTO "permissions" ("name", "description") VALUES
  ('users.read', 'Read user records'),
  ('users.manage_status', 'Change user account status'),
  ('roles.read', 'List roles and role assignments'),
  ('roles.assign', 'Assign and revoke user roles'),
  ('audit.read', 'Read the audit event log'),
  ('kyc.read', 'Read KYC case status'),
  ('kyc.review', 'Review and decide KYC cases'),
  ('kyc.documents.view', 'View KYC documents'),
  ('policies.read', 'Read system policies'),
  ('policies.manage', 'Update system policies'),
  ('withdrawals.read', 'Read withdrawal requests'),
  ('withdrawals.initiate', 'Initiate withdrawal payouts (maker)'),
  ('withdrawals.approve', 'Approve withdrawal payouts (checker)'),
  ('ledger.read', 'Read the financial ledger'),
  ('catalogue.manage', 'Manage the property catalogue')
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
-- ── Role → permission grants ─────────────────────────────────
-- investor: no permissions (implicit default)

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r, "permissions" p
WHERE r."name" = 'support' AND p."name" IN ('users.read', 'kyc.read')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r, "permissions" p
WHERE r."name" = 'kyc_reviewer' AND p."name" IN ('users.read', 'kyc.read', 'kyc.review', 'kyc.documents.view')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r, "permissions" p
WHERE r."name" = 'ops_admin' AND p."name" IN (
  'users.read', 'users.manage_status', 'roles.read', 'audit.read',
  'kyc.read', 'kyc.review', 'kyc.documents.view', 'policies.read',
  'withdrawals.read', 'withdrawals.initiate', 'catalogue.manage')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r, "permissions" p
WHERE r."name" = 'finance_admin' AND p."name" IN (
  'users.read', 'roles.read', 'audit.read', 'policies.read',
  'withdrawals.read', 'withdrawals.approve', 'ledger.read')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
--> statement-breakpoint
-- super_admin: every permission
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" = 'super_admin'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
--> statement-breakpoint
-- ── System policies ──────────────────────────────────────────
INSERT INTO "system_policies" ("key", "value", "description") VALUES
  ('admin.mfa_required', 'true'::jsonb,
   'Admin endpoints require Supabase MFA (aal2)'),
  ('admin.session_max_age_seconds', '43200'::jsonb,
   'Maximum admin session age in seconds'),
  ('kyc.withdrawal_gate', '{"enabled": true, "requiredTier": 1}'::jsonb,
   'KYC tier required before withdrawal — DEV DEFAULT, not approved production threshold'),
  ('identity.email_verification_required_for', '[]'::jsonb,
   'Actions requiring a verified email — mechanism only, no gate approved'),
  ('identity.username_change_allowed', 'true'::jsonb,
   'Whether users may change their username')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
-- ── Terms documents (DEVELOPMENT PLACEHOLDER — not counsel-approved) ──
INSERT INTO "terms_versions"
  ("doc_type", "version", "title", "summary", "sha256", "is_current", "effective_at")
VALUES
  ('TERMS', 'DEV-0.1',
   'RentBrown Terms of Use (DEVELOPMENT PLACEHOLDER)',
   'Development default terms for local/testing environments only — NOT reviewed or approved by counsel.',
   'b22fd47cb4fa84116243f8778334e072d9d45b43feeecb237d37d29f14ac749b',
   true, now()),
  ('PRIVACY', 'DEV-0.1',
   'RentBrown Privacy Notice (DEVELOPMENT PLACEHOLDER)',
   'Development default privacy notice for local/testing environments only — NOT reviewed or approved by counsel.',
   'ac08b5e79331315f6bac85d5ab394fcc0ecedeb9fc1d1864e718627eee1edfec',
   true, now())
ON CONFLICT ("doc_type", "version") DO NOTHING;
