/**
 * Typed API client — shared by web/mobile clients. This is a thin transport
 * wrapper; OpenAPI codegen can replace the method surface later without
 * changing call sites (they go through feature-level functions).
 *
 * Rules: money travels as minor-unit strings; every mutation supports an
 * idempotency key; the client NEVER computes financial values.
 */

import type {
  AccountStatus,
  AdminUserDto,
  ApiError,
  AuditEventDto,
  ConsentDto,
  LegalDocumentDto,
  MeDto,
  Paginated,
  PolicyDto,
  RoleDto,
  WalletSummaryDto,
} from "@rentbrown/types";

export interface ApiClientOptions {
  baseUrl: string;
  /** returns a fresh Supabase access token for Authorization header */
  getAccessToken?: () => Promise<string | null> | string | null;
  /** platform hint for the server capability model */
  platform?: "mobile" | "web";
  fetchImpl?: typeof fetch;
}

function qs(query?: Record<string, unknown>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
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
    return this.request<MeDto>("GET", "/v1/users/me");
  }

  updateProfile(patch: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    displayCurrency?: "NGN" | "USD";
    timezone?: string;
    notificationPrefs?: Record<string, boolean>;
  }) {
    return this.request<MeDto>("PATCH", "/v1/users/me", patch);
  }

  // ── Legal / consents ────────────────────────────────────────
  legalDocuments() {
    return this.request<LegalDocumentDto[]>("GET", "/v1/legal/documents");
  }

  myConsents() {
    return this.request<ConsentDto[]>("GET", "/v1/users/me/consents");
  }

  recordConsent(termsVersionId: string) {
    return this.request<ConsentDto>("POST", "/v1/users/me/consents", { termsVersionId });
  }

  // ── Admin ───────────────────────────────────────────────────
  readonly admin = {
    listUsers: (query?: { q?: string; status?: AccountStatus; cursor?: string; limit?: number }) =>
      this.request<Paginated<AdminUserDto>>(
        "GET",
        `/v1/admin/users${qs(query as Record<string, unknown>)}`,
      ),
    getUser: (id: string) => this.request<AdminUserDto>("GET", `/v1/admin/users/${id}`),
    setStatus: (id: string, status: AccountStatus, reason: string) =>
      this.request<AdminUserDto>("POST", `/v1/admin/users/${id}/status`, { status, reason }),
    assignRole: (id: string, role: string) =>
      this.request<void>("POST", `/v1/admin/users/${id}/roles`, { role }),
    revokeRole: (id: string, role: string) =>
      this.request<void>("DELETE", `/v1/admin/users/${id}/roles/${role}`),
    listRoles: () => this.request<RoleDto[]>("GET", "/v1/admin/roles"),
    listPolicies: () => this.request<PolicyDto[]>("GET", "/v1/admin/policies"),
    setPolicy: (key: string, value: unknown) =>
      this.request<PolicyDto>("PUT", `/v1/admin/policies/${encodeURIComponent(key)}`, { value }),
    listAudit: (query?: {
      targetType?: string;
      targetId?: string;
      actorId?: string;
      cursor?: string;
      limit?: number;
    }) =>
      this.request<Paginated<AuditEventDto>>(
        "GET",
        `/v1/admin/audit${qs(query as Record<string, unknown>)}`,
      ),
  };

  // ── Wallet (read projections — Phase 4 implements the writer) ─
  walletSummary() {
    return this.request<WalletSummaryDto>("GET", "/v1/wallet/summary");
  }
}
