/**
 * Money — integer minor units, bigint-backed. The ledger stores these values;
 * this module is the ONLY place arithmetic rules live.
 * Serialized form across API boundaries is a decimal STRING of minor units
 * (e.g. "150000") — never a JSON number and never a float.
 */

import { CURRENCY_SYMBOL, MINOR_UNIT_SCALE, type CurrencyCode } from "./currency.js";
import { mulBps } from "./rounding.js";

export type MinorUnits = bigint;

export function minor(value: bigint | number | string): MinorUnits {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error(`unsafe integer for money: ${value}`);
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value.trim())) throw new Error(`invalid minor-unit string: "${value}"`);
  return BigInt(value.trim());
}

export const ZERO: MinorUnits = 0n;

export function add(a: MinorUnits, b: MinorUnits): MinorUnits {
  return a + b;
}
export function sub(a: MinorUnits, b: MinorUnits): MinorUnits {
  return a - b;
}
export function mul(a: MinorUnits, qty: bigint | number): MinorUnits {
  return a * BigInt(qty);
}
export function isNegative(a: MinorUnits): boolean {
  return a < 0n;
}
export function isZero(a: MinorUnits): boolean {
  return a === 0n;
}
export function isPositive(a: MinorUnits): boolean {
  return a > 0n;
}
export function cmp(a: MinorUnits, b: MinorUnits): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}
export function min(a: MinorUnits, b: MinorUnits): MinorUnits {
  return a < b ? a : b;
}
export function max(a: MinorUnits, b: MinorUnits): MinorUnits {
  return a > b ? a : b;
}

/** apply basis points (5000 = 50.00%) with half-up rounding. */
export function applyBps(amount: MinorUnits, bps: number): MinorUnits {
  return mulBps(amount, bps);
}

/** percentage fee with cap: min(amount × pct/100, cap). pct given in bps. */
export function percentFeeCapped(amount: MinorUnits, feeBps: number, cap: MinorUnits): MinorUnits {
  return min(applyBps(amount, feeBps), cap);
}

/** parse a user-entered major-unit string ("1,500.50") into minor units. */
export function parseMajor(input: string, currency: CurrencyCode): MinorUnits {
  const scale = MINOR_UNIT_SCALE[currency];
  const cleaned = input.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error(`invalid amount: "${input}"`);
  }
  const [majorPart, fracPart = ""] = cleaned.split(".");
  const frac = (fracPart + "00").slice(0, 2);
  return BigInt(majorPart!) * BigInt(scale) + BigInt(frac);
}

/** format minor units for display: 150000 NGN → "₦1,500.00". */
export function format(amount: MinorUnits, currency: CurrencyCode): string {
  const scale = MINOR_UNIT_SCALE[currency];
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const major = abs / BigInt(scale);
  const frac = (abs % BigInt(scale)).toString().padStart(2, "0");
  const grouped = major.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${CURRENCY_SYMBOL[currency]}${grouped}.${frac}`;
}

/** serialize for API transport (minor units as string). */
export function serialize(amount: MinorUnits): string {
  return amount.toString();
}
