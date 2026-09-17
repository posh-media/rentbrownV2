import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client — auth operations ONLY (signup/login/session).
 * All domain/business/financial calls go through the NestJS API,
 * never directly to Supabase tables from the client.
 */
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
);
