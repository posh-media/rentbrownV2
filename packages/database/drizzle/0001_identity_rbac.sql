CREATE TYPE "public"."account_status" AS ENUM('ACTIVE', 'RESTRICTED', 'SUSPENDED', 'CLOSED');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "account_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "account_status" SET DATA TYPE account_status USING account_status::account_status;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "account_status" SET DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "system_policies" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "system_policies" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "terms_versions" ADD COLUMN "title" varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "terms_versions" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "terms_versions" ADD COLUMN "content_url" text;--> statement-breakpoint
ALTER TABLE "terms_versions" ADD COLUMN "is_current" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "terms_versions" ADD COLUMN "effective_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_consents" ADD COLUMN "doc_type" varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_consents" ADD COLUMN "version" varchar(32) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_consents" ADD COLUMN "user_agent_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "user_consents" ADD COLUMN "platform" "platform_name";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "terms_doc_version_uq" ON "terms_versions" USING btree ("doc_type","version");--> statement-breakpoint
CREATE UNIQUE INDEX "terms_current_uq" ON "terms_versions" USING btree ("doc_type") WHERE is_current = true;