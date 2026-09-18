/**
 * Shared domain entity types — wire-level shapes used by api-client and
 * frontend apps. Server-side Drizzle row types live in @rentbrown/database;
 * these are the API-facing DTO contracts.
 *
 * Money is ALWAYS serialized as a minor-unit string (e.g. "150000").
 */

import type { CurrencyCode } from "@rentbrown/domain";

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

// ── Identity ──────────────────────────────────────────────────
export type AccountStatus = "ACTIVE" | "RESTRICTED" | "SUSPENDED" | "CLOSED";

export interface UserDto {
  id: string;
  externalSubject: string;
  email: string | null;
  displayName: string | null;
  username: string | null;
  referralCode: string | null;
  accountCurrency: CurrencyCode;
  displayCurrency: CurrencyCode;
  accountStatus: AccountStatus;
  createdAt: string;
}

export interface NotificationPrefs {
  push?: boolean;
  email?: boolean;
  marketing?: boolean;
  maturity?: boolean;
  security?: boolean;
}

export type KycStatus =
  "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "MORE_INFO_REQUIRED" | "EXPIRED";

export interface KycSummaryDto {
  status: KycStatus | "NONE";
  tier: number;
  caseId?: string;
  requestedTier?: number;
  updatedAt?: string;
  canStart: boolean;
  nextSteps: string[];
  /** country → accepted ID types, from the kyc.allowed_id_types policy */
  allowedIdTypes: Record<string, string[]>;
}

export interface KycCheckDto {
  id: string;
  checkType: string | null;
  idType: string | null;
  idNumberLast4: string | null;
  country: string | null;
  status: string;
  outcome: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface KycDocumentDto {
  id: string;
  docType: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface KycCaseDto {
  id: string;
  status: KycStatus;
  requestedTier: number;
  currentTier: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  checks: KycCheckDto[];
  documents: KycDocumentDto[];
}

export interface KycDecisionDto {
  id: string;
  source: string;
  decision: string;
  reason: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  reviewerId: string | null;
  createdAt: string;
}

/** admin view — includes provider reason codes and internal notes */
export interface AdminKycCaseDto extends KycCaseDto {
  userId: string;
  userEmail: string | null;
  providerUserId: string | null;
  policyVersion: string | null;
  reasonCodes: unknown;
  notesInternal: string | null;
  checks: Array<KycCheckDto & { reasonCodes: unknown; providerMessage: string | null }>;
  decisions: KycDecisionDto[];
}

export interface KycGateDto {
  required: boolean;
  satisfied: boolean;
  requiredTier: number;
  currentTier: number;
  policyKey: string;
}

export interface MeDto extends UserDto {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  timezone: string | null;
  notificationPrefs: NotificationPrefs;
  emailVerifiedAt: string | null;
  roles: string[];
  permissions: string[];
  pendingConsents: string[];
  kyc: KycSummaryDto;
  capabilities: CapabilityMap;
}

export interface AdminUserDto extends UserDto {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  statusReason: string | null;
  statusChangedAt: string | null;
  lastSeenAt: string | null;
  roles: string[];
}

export interface ConsentSummaryDto {
  docType: string;
  version: string;
  acceptedAt: string;
}

// ── Legal / consents ──────────────────────────────────────────
export interface LegalDocumentDto {
  id: string;
  docType: string;
  version: string;
  title: string;
  summary: string | null;
  contentUrl: string | null;
  effectiveAt: string | null;
  publishedAt: string;
}

export interface ConsentDto {
  id: string;
  termsVersionId: string;
  docType: string;
  version: string;
  acceptedAt: string;
  platform: PlatformName | null;
}

// ── RBAC / admin ──────────────────────────────────────────────
export interface RoleDto {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
}

export interface PolicyDto {
  key: string;
  value: unknown;
  description: string | null;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
}

export interface AuditEventDto {
  id: string;
  actorId: string | null;
  actorType: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  requestId: string | null;
  diffRedacted: unknown;
  metadata: unknown;
  createdAt: string;
}

// ── Capability model (RB-094) ─────────────────────────────────
export type PlatformName = "mobile" | "web";

/** Server-driven capability map — never hardcode platform rules client-side. */
export interface CapabilityMap {
  [action: string]: {
    allowed: boolean;
    requiresPlatform?: PlatformName;
    reason?: string;
  };
}

// ── Catalogue ─────────────────────────────────────────────────
export interface PropertyDto {
  id: string;
  slug: string;
  name: string;
  status: string;
  locationPublic: string | null;
  heroImageUrl: string | null;
  summary: string | null;
}

export interface InvestmentPlanDto {
  id: string;
  propertyId: string;
  currency: CurrencyCode;
  slotPriceMinor: string;
  roiBps: number;
  durationValue: number;
  durationUnit: string;
  status: string;
}

export interface RoundDto {
  id: string;
  planId: string;
  currency: CurrencyCode;
  slotPriceMinor: string;
  roiBps: number;
  totalSlots: number;
  availableSlots: number;
  perUserMaxSlots: number | null;
  opensAt: string;
  closesAt: string;
  status: string;
}

// ── Wallet (read projections only — server is the authority) ──
export interface WalletAccountDto {
  currency: CurrencyCode;
  type: "AVAILABLE" | "RESERVED" | "BONUS" | "BONUS_PENDING";
  balanceMinor: string;
}

export interface WalletSummaryDto {
  accounts: WalletAccountDto[];
  displayCurrency: CurrencyCode;
  fxRateUsed?: string;
  fxRateAt?: string;
}
