CREATE TYPE "public"."kyc_status" AS ENUM('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'MORE_INFO_REQUIRED', 'EXPIRED');--> statement-breakpoint
ALTER TABLE "kyc_cases" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "kyc_cases" ALTER COLUMN "status" SET DATA TYPE kyc_status USING status::kyc_status;--> statement-breakpoint
ALTER TABLE "kyc_cases" ALTER COLUMN "status" SET DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE "kyc_cases" ADD COLUMN "policy_version" varchar(32);--> statement-breakpoint
ALTER TABLE "kyc_cases" ADD COLUMN "provider_user_id" varchar(128);--> statement-breakpoint
ALTER TABLE "kyc_cases" ADD COLUMN "last_provider_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kyc_cases" ADD COLUMN "notes_internal" text;--> statement-breakpoint
ALTER TABLE "kyc_cases" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kyc_checks" ADD COLUMN "status" varchar(32) DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_checks" ADD COLUMN "id_type" varchar(32);--> statement-breakpoint
ALTER TABLE "kyc_checks" ADD COLUMN "country" varchar(2);--> statement-breakpoint
ALTER TABLE "kyc_checks" ADD COLUMN "id_number_last4" varchar(4);--> statement-breakpoint
ALTER TABLE "kyc_checks" ADD COLUMN "id_number_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "kyc_checks" ADD COLUMN "outcome" varchar(32);--> statement-breakpoint
ALTER TABLE "kyc_checks" ADD COLUMN "reason_codes" jsonb;--> statement-breakpoint
ALTER TABLE "kyc_checks" ADD COLUMN "provider_message" text;--> statement-breakpoint
ALTER TABLE "kyc_checks" ADD COLUMN "raw_redacted" jsonb;--> statement-breakpoint
ALTER TABLE "kyc_checks" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kyc_checks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_decisions" ADD COLUMN "check_id" uuid;--> statement-breakpoint
ALTER TABLE "kyc_decisions" ADD COLUMN "source" varchar(16) DEFAULT 'PROVIDER' NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_decisions" ADD COLUMN "from_status" varchar(32);--> statement-breakpoint
ALTER TABLE "kyc_decisions" ADD COLUMN "to_status" varchar(32);--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD COLUMN "bucket" varchar(64) DEFAULT 'kyc-documents' NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD COLUMN "content_type" varchar(64);--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD COLUMN "size_bytes" integer;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD COLUMN "sha256" varchar(64);--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD COLUMN "uploaded_by" uuid;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "payload_redacted" jsonb;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_one_open_case_uq" ON "kyc_cases" USING btree ("user_id") WHERE status IN ('DRAFT','SUBMITTED','IN_REVIEW','MORE_INFO_REQUIRED');--> statement-breakpoint
CREATE INDEX "kyc_checks_case_idx" ON "kyc_checks" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_checks_job_uq" ON "kyc_checks" USING btree ("provider_job_id") WHERE provider_job_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "kyc_decisions_case_idx" ON "kyc_decisions" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "kyc_documents_case_idx" ON "kyc_documents" USING btree ("case_id");