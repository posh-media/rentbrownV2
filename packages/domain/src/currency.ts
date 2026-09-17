/**
 * Currency model — four distinct concepts (see docs/FINANCIAL_MODEL.md §5):
 * wallet currency, plan/investment currency, display currency, settlement currency.
 * Money is always integer minor units. Never floating point.
 */

export const CURRENCIES = ["NGN", "USD"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "NGN";

/** Minor units per major unit (kobo/cents). */
export const MINOR_UNIT_SCALE: Record<CurrencyCode, number> = {
  NGN: 100,
  USD: 100,
};

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  NGN: "₦",
  USD: "$",
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export function assertCurrency(value: unknown): asserts value is CurrencyCode {
  if (!isCurrencyCode(value)) {
    throw new Error(`Unsupported currency: ${String(value)}`);
  }
}
