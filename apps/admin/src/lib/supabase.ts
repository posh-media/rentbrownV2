import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client — auth operations ONLY (signup/login/session).
 * All domain/business/financial calls go through the NestJS API,
 * never directly to Supabase tables from the client.
 */
export const supabase = createClient(
  // placeholder keeps static prerendering working when env vars are unset;
  // real values are injected at deploy/dev time via NEXT_PUBLIC_*
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
);
