CREATE TYPE "public"."currency_code" AS ENUM('NGN', 'USD');--> statement-breakpoint
CREATE TYPE "public"."duration_unit" AS ENUM('HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS');--> statement-breakpoint
CREATE TYPE "public"."investment_status" AS ENUM('CHECKOUT_INITIATED', 'PAYMENT_PENDING', 'PAYMENT_EXPIRED', 'PAYMENT_VERIFIED', 'ACTIVE', 'MATURITY_DUE', 'SETTLEMENT_PENDING', 'COMPLETED', 'REFUND_INITIATED', 'REFUNDED', 'REFUND_FAILED', 'OPS_ESCALATED', 'REVIEW_REQUIRED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."ledger_direction" AS ENUM('DEBIT', 'CREDIT');--> statement-breakpoint
CREATE TYPE "public"."platform_name" AS ENUM('mobile', 'web');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED_TO_NEW', 'SETTLING', 'SETTLED', 'ARCHIVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."wallet_account_type" AS ENUM('AVAILABLE', 'RESERVED', 'BONUS', 'BONUS_PENDING');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('REQUESTED', 'FUNDS_RESERVED', 'PENDING_MANUAL_PAYOUT', 'COMPLETED', 'REJECTED', 'REJECTED_RELEASED', 'FAILED_RELEASED');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_type" varchar(32) DEFAULT 'USER' NOT NULL,
	"action" varchar(128) NOT NULL,
	"target_type" varchar(64),
	"target_id" varchar(128),
	"request_id" varchar(64),
	"diff_redacted" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposit_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" "currency_code" NOT NULL,
	"status" varchar(32) DEFAULT 'INTENT_CREATED' NOT NULL,
	"provider_ref" varchar(255),
	"idempotency_key" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base" "currency_code" NOT NULL,
	"quote" "currency_code" NOT NULL,
	"rate" text NOT NULL,
	"source" varchar(64),
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" varchar(128) NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" varchar(64) NOT NULL,
	"request_hash" varchar(64),
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "investment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"currency" "currency_code" NOT NULL,
	"slot_price_minor" bigint NOT NULL,
	"roi_bps" integer NOT NULL,
	"duration_value" integer NOT NULL,
	"duration_unit" "duration_unit" NOT NULL,
	"status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_slot_price_pos" CHECK (slot_price_minor > 0),
	CONSTRAINT "plans_roi_nonneg" CHECK (roi_bps >= 0),
	CONSTRAINT "plans_duration_pos" CHECK (duration_value > 0)
);
--> statement-breakpoint
CREATE TABLE "investment_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"total_slots" integer NOT NULL,
	"available_slots" integer NOT NULL,
	"allocated_slots" integer DEFAULT 0 NOT NULL,
	"per_user_max_slots" integer,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"status" "round_status" DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rounds_total_pos" CHECK (total_slots > 0),
	CONSTRAINT "rounds_available_nonneg" CHECK (available_slots >= 0),
	CONSTRAINT "rounds_allocated_nonneg" CHECK (allocated_slots >= 0),
	CONSTRAINT "rounds_capacity_bound" CHECK (available_slots + allocated_slots <= total_slots),
	CONSTRAINT "rounds_per_user_max_pos" CHECK (per_user_max_slots IS NULL OR per_user_max_slots > 0)
);
--> statement-breakpoint
CREATE TABLE "investments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"status" "investment_status" NOT NULL,
	"currency" "currency_code" NOT NULL,
	"slot_quantity" integer NOT NULL,
	"slot_price_minor" bigint NOT NULL,
	"principal_minor" bigint NOT NULL,
	"roi_bps" integer NOT NULL,
	"duration_value" integer NOT NULL,
	"duration_unit" "duration_unit" NOT NULL,
	"expected_profit_minor" bigint NOT NULL,
	"expected_maturity_minor" bigint NOT NULL,
	"funding_type" varchar(16) NOT NULL,
	"activated_at" timestamp with time zone,
	"matures_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"idempotency_key" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inv_qty_pos" CHECK (slot_quantity > 0),
	CONSTRAINT "inv_amounts_nonneg" CHECK (principal_minor >= 0 AND expected_profit_minor >= 0)
);
--> statement-breakpoint
CREATE TABLE "kyc_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(32) DEFAULT 'SMILE_IDENTITY' NOT NULL,
	"requested_tier" integer DEFAULT 1 NOT NULL,
	"current_tier" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"reason_codes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"provider_job_id" varchar(255),
	"check_type" varchar(64),
	"result" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"reviewer_id" uuid,
	"decision" varchar(32) NOT NULL,
	"reason" text,
	"policy_version" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"doc_type" varchar(64) NOT NULL,
	"storage_key" text,
	"provider_token" varchar(255),
	"retention_status" varchar(32) DEFAULT 'RETAINED',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"direction" "ledger_direction" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" "currency_code" NOT NULL,
	"balance_after_minor" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_amount_pos" CHECK (amount_minor > 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'POSTED' NOT NULL,
	"currency" "currency_code" NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"actor_id" uuid,
	"subject_id" uuid,
	"investment_id" uuid,
	"deposit_id" uuid,
	"withdrawal_id" uuid,
	"reward_grant_id" uuid,
	"provider" varchar(64),
	"provider_ref" varchar(255),
	"reversal_of" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"deep_link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" varchar(64) NOT NULL,
	"aggregate_id" uuid,
	"event_type" varchar(128) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payout_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(32) DEFAULT 'BANK' NOT NULL,
	"bank_code" varchar(16),
	"account_number_masked" varchar(20),
	"account_name" varchar(255),
	"currency" "currency_code" DEFAULT 'NGN' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "platform_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"currency" "currency_code" NOT NULL,
	"description" text,
	"balance_minor" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(160) NOT NULL,
	"name" varchar(200) NOT NULL,
	"status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"summary" text,
	"details" text,
	"category" varchar(64),
	"location_public" varchar(255),
	"hero_image_url" text,
	"business_info" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"type" varchar(64) NOT NULL,
	"title" varchar(255),
	"storage_key" text NOT NULL,
	"sha256" varchar(64),
	"review_status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_user_id" uuid NOT NULL,
	"code_snapshot" varchar(64) NOT NULL,
	"campaign" varchar(64),
	"attributed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_user_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"source_amount_minor" bigint NOT NULL,
	"source_currency" "currency_code" DEFAULT 'NGN' NOT NULL,
	"fx_rate" text,
	"fx_rate_at" timestamp with time zone,
	"credited_amount_minor" bigint,
	"target_currency" "currency_code",
	"triggering_deposit_id" uuid,
	"qualifying_deposit_minor" bigint,
	"credited_at" timestamp with time zone,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "system_policies" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terms_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_type" varchar(64) NOT NULL,
	"version" varchar(32) NOT NULL,
	"sha256" varchar(64),
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"terms_version_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" uuid
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_subject" varchar(255) NOT NULL,
	"email" varchar(320),
	"phone" varchar(32),
	"display_name" varchar(120),
	"username" varchar(30),
	"referral_code" varchar(64),
	"account_currency" "currency_code" DEFAULT 'NGN' NOT NULL,
	"display_currency" "currency_code" DEFAULT 'NGN' NOT NULL,
	"account_status" varchar(32) DEFAULT 'ACTIVE' NOT NULL,
	"pin_hash" text,
	"pin_set_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"currency" "currency_code" NOT NULL,
	"type" "wallet_account_type" NOT NULL,
	"balance_minor" bigint DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(32) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_nonneg" CHECK (balance_minor >= 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"event_type" varchar(128),
	"payload_hash" varchar(64),
	"status" varchar(32) DEFAULT 'RECEIVED' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"payout_method_id" uuid,
	"currency" "currency_code" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"fee_minor" bigint DEFAULT 0 NOT NULL,
	"net_payout_minor" bigint,
	"status" "withdrawal_status" DEFAULT 'REQUESTED' NOT NULL,
	"review_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"payment_reference" varchar(255),
	"paid_at" timestamp with time zone,
	"idempotency_key" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deposit_intents" ADD CONSTRAINT "deposit_intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_plans" ADD CONSTRAINT "investment_plans_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_rounds" ADD CONSTRAINT "investment_rounds_plan_id_investment_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."investment_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_round_id_investment_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."investment_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_plan_id_investment_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."investment_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_cases" ADD CONSTRAINT "kyc_cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_checks" ADD CONSTRAINT "kyc_checks_case_id_kyc_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."kyc_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_decisions" ADD CONSTRAINT "kyc_decisions_case_id_kyc_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."kyc_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_case_id_kyc_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."kyc_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_methods" ADD CONSTRAINT "payout_methods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_grants" ADD CONSTRAINT "reward_grants_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_grants" ADD CONSTRAINT "reward_grants_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_terms_version_id_terms_versions_id_fk" FOREIGN KEY ("terms_version_id") REFERENCES "public"."terms_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_accounts" ADD CONSTRAINT "wallet_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_payout_method_id_payout_methods_id_fk" FOREIGN KEY ("payout_method_id") REFERENCES "public"."payout_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_target_idx" ON "audit_events" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_events" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_provider_ref_uq" ON "deposit_intents" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_idem_uq" ON "deposit_intents" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "deposit_user_idx" ON "deposit_intents" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "fx_pair_idx" ON "fx_rates" USING btree ("base","quote","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idem_uq" ON "idempotency_keys" USING btree ("user_id","scope","key");--> statement-breakpoint
CREATE INDEX "plans_property_idx" ON "investment_plans" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "rounds_status_idx" ON "investment_rounds" USING btree ("status","opens_at","closes_at");--> statement-breakpoint
CREATE INDEX "rounds_plan_idx" ON "investment_rounds" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "inv_user_status_idx" ON "investments" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "inv_matures_idx" ON "investments" USING btree ("status","matures_at");--> statement-breakpoint
CREATE INDEX "inv_round_idx" ON "investments" USING btree ("round_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inv_idem_uq" ON "investments" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "kyc_user_status_idx" ON "kyc_cases" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "entries_txn_idx" ON "ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "entries_account_idx" ON "ledger_entries" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_txn_idem_uq" ON "ledger_transactions" USING btree ("type","idempotency_key");--> statement-breakpoint
CREATE INDEX "ledger_txn_subject_idx" ON "ledger_transactions" USING btree ("subject_id","posted_at");--> statement-breakpoint
CREATE INDEX "ledger_txn_type_idx" ON "ledger_transactions" USING btree ("type","posted_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox_events" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "payout_methods_user_idx" ON "payout_methods" USING btree ("user_id","verified");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_accounts_code_uq" ON "platform_accounts" USING btree ("code","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_slug_uq" ON "properties" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "properties_status_idx" ON "properties" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "property_documents_property_idx" ON "property_documents" USING btree ("property_id","review_status");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_referred_uq" ON "referral_attributions" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "referral_referrer_idx" ON "referral_attributions" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "reward_referrer_idx" ON "reward_grants" USING btree ("referrer_id","status");--> statement-breakpoint
CREATE INDEX "reward_referred_idx" ON "reward_grants" USING btree ("referred_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_uq" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_uq" ON "user_consents" USING btree ("user_id","terms_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_uq" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_external_subject_uq" ON "users" USING btree ("external_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_referral_code_uq" ON "users" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("account_status");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_uq" ON "wallet_accounts" USING btree ("user_id","currency","type");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_uq" ON "webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "withdrawal_idem_uq" ON "withdrawals" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "withdrawal_status_idx" ON "withdrawals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "withdrawal_user_idx" ON "withdrawals" USING btree ("user_id","created_at");