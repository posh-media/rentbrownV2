/**
 * Typed API client — shared by web/mobile clients. This is a thin transport
 * wrapper; OpenAPI codegen can replace the method surface later without
 * changing call sites (they go through feature-level functions).
 *
 * Rules: money travels as minor-unit strings; every mutation supports an
 * idempotency key; the client NEVER computes financial values.
 */

import type { ApiError, UserDto, WalletSummaryDto } from "@rentbrown/types";

export interface ApiClientOptions {
  baseUrl: string;
  /** returns a fresh Supabase access token for Authorization header */
  getAccessToken?: () => Promise<string | null> | string | null;
  /** platform hint for the server capability model */
  platform?: "mobile" | "web";
  fetchImpl?: typeof fetch;
}

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public requestId?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export class ApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private opts: ApiClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
    };
    if (this.opts.platform) headers["x-platform"] = this.opts.platform;
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
    const token = await this.opts.getAccessToken?.();
    if (token) headers.authorization = `Bearer ${token}`;

    const res = await this.fetchImpl(`${this.opts.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      let parsed: ApiError | undefined;
      try {
        parsed = (await res.json()) as ApiError;
      } catch {
        /* non-json error body */
      }
      throw new ApiClientError(
        parsed?.error.code ?? `HTTP_${res.status}`,
        parsed?.error.message ?? res.statusText,
        res.status,
        parsed?.error.requestId,
        parsed?.error.details,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // ── System ──────────────────────────────────────────────────
  health() {
    return this.request<{ status: string; ts: string }>("GET", "/health");
  }
  ready() {
    return this.request<{ status: string; db: string; poolTotal: number }>("GET", "/health/ready");
  }

  // ── Identity ────────────────────────────────────────────────
  me() {
    return this.request<UserDto>("GET", "/v1/users/me");
  }

  // ── Wallet (read projections — Phase 4 implements the writer) ─
  walletSummary() {
    return this.request<WalletSummaryDto>("GET", "/v1/wallet/summary");
  }
}
