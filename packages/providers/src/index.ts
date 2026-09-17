/**
 * Provider ports — domain-facing interfaces only. Provider SDKs (Paystack,
 * Korapay, Smile Identity, Expo Push, Telegram, email, Supabase Storage)
 * live in API-side adapters implementing these contracts; domain code
 * never sees provider-specific types.
 *
 * All money fields are integer minor units (bigint). Currency is the
 * account currency — display conversion happens elsewhere via fx snapshots.
 */

import type { CurrencyCode } from "@rentbrown/domain";

// ── Payments (Paystack, Korapay) ──────────────────────────────

export interface PaymentInitRequest {
  /** internal deposit intent id — sent to provider as reference */
  reference: string;
  amountMinor: bigint;
  currency: CurrencyCode;
  customerEmail: string;
  /** where the provider redirects after checkout */
  callbackUrl: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitResult {
  provider: string;
  providerReference: string;
  /** hosted checkout / authorization URL for the client */
  authorizationUrl: string;
}

export interface PaymentVerification {
  provider: string;
  providerReference: string;
  status: "SUCCEEDED" | "FAILED" | "PENDING";
  amountMinor: bigint;
  currency: CurrencyCode;
  /** provider's own paid-at timestamp when available */
  paidAt?: Date;
  /** raw provider payload — stored for reconciliation */
  raw: unknown;
}

export interface RefundRequest {
  providerReference: string;
  amountMinor?: bigint; // omit for full refund
  reason?: string;
}

export interface RefundResult {
  provider: string;
  refundReference: string;
  status: "INITIATED" | "COMPLETED" | "FAILED";
}

export interface PaymentProvider {
  readonly name: "paystack" | "korapay";
  initializePayment(req: PaymentInitRequest): Promise<PaymentInitResult>;
  /** server-side verification — never trust client-supplied success */
  verifyPayment(providerReference: string): Promise<PaymentVerification>;
  /** validate + parse a signed webhook payload */
  parseWebhook(rawBody: string | Buffer, signature: string): PaymentVerification;
  initiateRefund(req: RefundRequest): Promise<RefundResult>;
}

// ── KYC (Smile Identity behind this port) ─────────────────────

export interface KycSubmitRequest {
  userId: string;
  caseId: string;
  checkId: string;
  checkType: "ID_VERIFICATION" | "DOCUMENT" | "LIVENESS";
  country: string; // ISO 3166-1 alpha-2, e.g. "NG"
  idType: string; // e.g. "NIN", "BVN" — mapped per provider
  idNumber: string;
  person: { firstName: string; lastName: string; email?: string; dob?: string };
  consent: { grantedAt: Date; privacyPolicyUrl: string };
  callbackUrl?: string;
}

export interface KycCaseHandle {
  provider: string;
  providerJobId: string;
  providerUserId?: string;
}

export interface KycDecision {
  providerJobId: string;
  outcome: "APPROVED" | "REJECTED" | "PENDING" | "NEEDS_REVIEW" | "ERROR";
  reasonCodes: string[];
  message?: string;
  completedAt?: Date;
  /** allowlisted subset of the provider payload — never raw PII */
  rawRedacted: Record<string, unknown>;
}

export interface KycProvider {
  readonly name: string;
  submitCheck(req: KycSubmitRequest): Promise<KycCaseHandle>;
  fetchDecision(providerJobId: string): Promise<KycDecision>;
  /** signature + replay-window check on a raw callback — pure */
  verifyCallback(
    headers: Record<string, string | undefined>,
    rawBody: Buffer | string,
  ): { ok: boolean; reason?: string };
  /** map a verified callback body to a normalized decision — pure */
  parseCallback(body: unknown, headers: Record<string, string | undefined>): KycDecision;
}

const KYC_PAYLOAD_ALLOWLIST = new Set([
  "status",
  "message",
  "reason",
  "product",
  "job_id",
  "user_id",
  "created_at",
  "completed_at",
  "partner_params",
]);

/**
 * Allowlist redaction for provider KYC payloads — keeps outcome metadata,
 * drops everything else. `id_fields` is reduced to its key NAMES only (never
 * values — those are document numbers). `antifraud` keeps only its status.
 */
export function redactKycPayload(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (KYC_PAYLOAD_ALLOWLIST.has(key)) out[key] = value;
  }
  const src = input as Record<string, unknown>;
  if (typeof src.id_fields === "object" && src.id_fields !== null) {
    out.id_fields = Object.keys(src.id_fields as Record<string, unknown>);
  }
  if (typeof src.antifraud === "object" && src.antifraud !== null) {
    const af = src.antifraud as Record<string, unknown>;
    if (typeof af.status === "string") out.antifraud = { status: af.status };
  }
  return out;
}

// ── Notifications ─────────────────────────────────────────────

export interface NotificationMessage {
  userId: string;
  templateKey: string;
  params?: Record<string, string>;
  /** routing hint — adapters may ignore */
  channels?: Array<"push" | "email" | "in_app">;
}

export interface NotificationProvider {
  readonly name: string;
  send(msg: NotificationMessage): Promise<{ deliveryId: string }>;
}

export interface PushProvider {
  readonly name: string;
  /** Expo push tokens are opaque strings managed client-side */
  sendToTokens(
    tokens: string[],
    msg: NotificationMessage,
  ): Promise<{
    delivered: number;
    failures: Array<{ token: string; reason: string }>;
  }>;
}

export interface EmailProvider {
  readonly name: string;
  send(opts: {
    to: string;
    templateKey: string;
    params?: Record<string, string>;
  }): Promise<{ messageId: string }>;
}

// ── Storage (Supabase Storage) ────────────────────────────────

export interface StorageProvider {
  readonly name: string;
  /** upload to a private bucket — returns the object ref, never a public URL */
  uploadPrivate(bucket: string, path: string, data: Buffer, contentType: string): Promise<string>;
  /** short-lived signed URL for authorized viewing of private objects */
  createSignedUrl(objectRef: string, ttlSeconds: number): Promise<string>;
  delete(objectRef: string): Promise<void>;
}
