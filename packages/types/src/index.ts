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
export interface UserDto {
  id: string;
  externalSubject: string;
  email: string | null;
  displayName: string | null;
  username: string | null;
  referralCode: string | null;
  accountCurrency: CurrencyCode;
  displayCurrency: CurrencyCode;
  accountStatus: "ACTIVE" | "RESTRICTED" | "SUSPENDED" | "CLOSED";
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
