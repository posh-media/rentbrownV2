import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client — auth operations ONLY (signup/login/session/MFA).
 * All domain/business/financial calls go through the NestJS API,
 * never directly to Supabase tables from the client.
 *
 * Session persistence uses AsyncStorage per Supabase's official Expo guide.
 * Follow-up: migrate to a chunked SecureStore adapter for smaller-keyed
 * hardening (documented in docs/DEPLOYMENT.md).
 */
export const supabase = createClient(
  // placeholder keeps web-export bundling working when env vars are unset;
  // real values come from apps/mobile/.env (EXPO_PUBLIC_*)
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
