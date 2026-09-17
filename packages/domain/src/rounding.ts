/**
 * Deterministic rounding — docs/FINANCIAL_MODEL.md §9.
 * All money math is integer minor units (bigint). Rounding rule: HALF-UP to the
 * nearest minor unit, applied once at the defined computation point and then
 * snapshotted — never recomputed.
 */

/** divide numerator by denominator, rounding half-up. Only for non-negative integers. */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("denominator must be positive");
  if (numerator < 0n) throw new Error("negative amounts are not supported in divRoundHalfUp");
  return (numerator * 2n + denominator) / (2n * denominator);
}

/** multiply by an integer ratio expressed in basis points (bps), half-up. 5000 = 50%. */
export function mulBps(amountMinor: bigint, bps: number): bigint {
  if (!Number.isInteger(bps) || bps < 0) throw new Error(`invalid basis points: ${bps}`);
  if (amountMinor < 0n) throw new Error("negative amounts are not supported in mulBps");
  return divRoundHalfUp(amountMinor * BigInt(bps), 10000n);
}

/** multiply by an integer percentage rate, half-up. */
export function mulRatio(numerator: bigint, multiplier: bigint, divisor: bigint): bigint {
  if (divisor <= 0n) throw new Error("divisor must be positive");
  if (numerator < 0n || multiplier < 0n) throw new Error("negative inputs not supported");
  return divRoundHalfUp(numerator * multiplier, divisor);
}
