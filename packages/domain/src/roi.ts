/**
 * Fixed full-term return model (RB-001):
 *   profit  = principal × ROI          (computed once, half-up, snapshotted)
 *   total   = principal + profit
 *   principal = slot_quantity × slot_price
 * ROI is integer basis points: 5000 = 50.00%.
 * The engine never recalculates returns from business performance.
 */

import { mul, type MinorUnits } from "./money.js";
import { mulBps } from "./rounding.js";

export type BasisPoints = number;

export function assertBps(bps: number): asserts bps is BasisPoints {
  if (!Number.isInteger(bps) || bps < 0 || bps > 1_000_000) {
    throw new Error(`invalid ROI basis points: ${bps}`);
  }
}

export interface InvestmentEconomics {
  slotQuantity: number;
  slotPriceMinor: MinorUnits;
  roiBps: BasisPoints;
  principalMinor: MinorUnits;
  profitMinor: MinorUnits;
  maturityValueMinor: MinorUnits;
}

/** Compute and snapshot an investment's economics. qty must be a positive int. */
export function computeInvestmentEconomics(
  slotPriceMinor: MinorUnits,
  slotQuantity: number,
  roiBps: BasisPoints,
): InvestmentEconomics {
  if (!Number.isInteger(slotQuantity) || slotQuantity <= 0) {
    throw new Error(`invalid slot quantity: ${slotQuantity}`);
  }
  assertBps(roiBps);
  if (slotPriceMinor <= 0n) throw new Error("slot price must be positive");
  const principal = mul(slotPriceMinor, slotQuantity);
  const profit = mulBps(principal, roiBps);
  return {
    slotQuantity,
    slotPriceMinor,
    roiBps,
    principalMinor: principal,
    profitMinor: profit,
    maturityValueMinor: principal + profit,
  };
}

/**
 * One-slot maturity value — used by the minimum-withdrawal rule (RB-045):
 * min withdrawal = cheapest published plan's 1-slot maturity value.
 */
export function oneSlotMaturityValue(slotPriceMinor: MinorUnits, roiBps: BasisPoints): MinorUnits {
  return computeInvestmentEconomics(slotPriceMinor, 1, roiBps).maturityValueMinor;
}

/**
 * Referral deposit reward (RB-073): 5% of qualifying deposit, capped per transaction.
 */
export function referralDepositReward(
  depositMinor: MinorUnits,
  rewardBps: number,
  perTransactionCapMinor: MinorUnits,
): MinorUnits {
  const reward = mulBps(depositMinor, rewardBps);
  return reward > perTransactionCapMinor ? perTransactionCapMinor : reward;
}
