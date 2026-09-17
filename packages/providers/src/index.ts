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
  /** internal command — provider-agnostic job/check type */
  checkType: "BASIC_KYC" | "ID_VERIFICATION" | "LIVENESS" | "DOCUMENT";
  idType?: string; // e.g. "BVN", "NIN", "PASSPORT" — mapped per provider
  idNumber?: string;
  /** storage object refs for uploaded documents/selfies */
  documentRefs?: string[];
  metadata?: Record<string, unknown>;
}

export interface KycCaseHandle {
  provider: string;
  providerCaseId: string;
}

export interface KycDecision {
  providerCaseId: string;
  outcome: "APPROVED" | "REJECTED" | "PENDING" | "NEEDS_REVIEW";
  reasonCodes: string[];
  raw: unknown;
}

export interface KycProvider {
  readonly name: string;
  submitCheck(req: KycSubmitRequest): Promise<KycCaseHandle>;
  fetchDecision(providerCaseId: string): Promise<KycDecision>;
  /** validate + parse a signed provider callback */
  parseCallback(rawBody: string | Buffer, signature: string): KycDecision;
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
