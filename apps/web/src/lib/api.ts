import { ApiClient } from "@rentbrown/api-client";

/** browser-side API client — auth token wired via Supabase session later */
export const api = new ApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  platform: "web",
});
