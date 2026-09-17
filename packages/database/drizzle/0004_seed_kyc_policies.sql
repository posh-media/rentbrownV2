-- Seed: KYC policy keys. Idempotent — safe to re-run.
-- Tier definitions and thresholds are DEV DEFAULTS — not approved thresholds.

--> statement-breakpoint
INSERT INTO "system_policies" ("key", "value", "description") VALUES
  ('kyc.tiers',
   '{"1": {"label": "Basic identity", "checks": ["ID_VERIFICATION"]}, "2": {"label": "Enhanced", "checks": ["ID_VERIFICATION", "DOCUMENT"]}}'::jsonb,
   'KYC tier definitions — DEV DEFAULT, not approved thresholds'),
  ('kyc.allowed_id_types',
   '{"NG": ["NIN", "BVN"]}'::jsonb,
   'ID types accepted per country — DEV DEFAULT'),
  ('kyc.document_max_bytes',
   '5242880'::jsonb,
   'Maximum KYC document upload size in bytes'),
  ('kyc.document_allowed_types',
   '["image/jpeg", "image/png", "application/pdf"]'::jsonb,
   'Allowed MIME types for KYC document uploads'),
  ('kyc.case_expiry_days',
   '30'::jsonb,
   'Days before a stale KYC case is marked EXPIRED')
ON CONFLICT ("key") DO NOTHING;
