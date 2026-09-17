/**
 * Typed environment configuration — validated at boot. Fails fast on missing
 * or malformed config rather than surfacing it as a runtime financial error.
 */

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),

  // API
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_PUBLIC_URL: z.string().url().default("http://localhost:3001"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  DATABASE_URL: z.string().min(1),

  // Cloud Scheduler → API sweep auth (shared secret header)
  SCHEDULER_SECRET: z.string().min(32).optional(),

  // Admin security
  // dev override — "false" skips the MFA guard ONLY when APP_ENV != production
  ADMIN_MFA_ENFORCE: z.enum(["true", "false"]).default("true"),
  // comma-separated emails granted super_admin on first provisioning
  BOOTSTRAP_SUPER_ADMIN_EMAILS: z.string().optional(),

  // Providers — optional until their phase lands
  PAYSTACK_SECRET_KEY: z.string().optional(),
  KORAPAY_SECRET_KEY: z.string().optional(),
  SMILE_IDENTITY_PARTNER_ID: z.string().optional(),
  SMILE_IDENTITY_API_KEY: z.string().optional(),
  SMILE_IDENTITY_CALLBACK_URL: z.string().url().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional(),
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ");
    throw new Error(`Invalid environment configuration:\n  ${issues}`);
  }
  return result.data;
}

export const isProd = (c: AppConfig) => c.APP_ENV === "production";
export const isStaging = (c: AppConfig) => c.APP_ENV === "staging";
export const isDev = (c: AppConfig) => c.APP_ENV === "development";
