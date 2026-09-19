import { envOr, envUrlOr } from "@rentbrown/api-client";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client — auth operations ONLY (signup/login/session).
 * All domain/business/financial calls go through the NestJS API,
 * never directly to Supabase tables from the client.
 */
export const supabase = createClient(
  // placeholder keeps static prerendering working when env vars are unset,
  // empty, or malformed — `??` alone would pass "" through to createClient,
  // which throws at module load and fails static export
  envUrlOr(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "https://placeholder.supabase.co",
    "NEXT_PUBLIC_SUPABASE_URL",
  ),
  envOr(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "placeholder-anon-key",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ),
);
