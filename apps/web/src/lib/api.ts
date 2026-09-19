import { ApiClient, ApiClientError, envUrlOr } from "@rentbrown/api-client";
import { supabase } from "./supabase";

/**
 * Domain API client — every business call goes through the NestJS API.
 * The Supabase access token is attached as a Bearer token; the client never
 * computes financial values or authorization decisions.
 */
export const api = new ApiClient({
  baseUrl: envUrlOr(
    process.env.NEXT_PUBLIC_API_URL,
    "http://localhost:3001",
    "NEXT_PUBLIC_API_URL",
  ),
  platform: "web",
  getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});

/** human-readable surface for API errors — never raw provider data */
export function errorText(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong — please try again";
}

export function errorCode(err: unknown): string | null {
  return err instanceof ApiClientError ? err.code : null;
}
