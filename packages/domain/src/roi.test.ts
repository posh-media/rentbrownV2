import { describe, expect, it } from "vitest";
import { computeInvestmentEconomics, oneSlotMaturityValue, referralDepositReward } from "./roi.js";

describe("roi", () => {
  it("computes the canonical example: 2 × ₦1,000 @ 50% → ₦3,000", () => {
    const r = computeInvestmentEconomics(100000n, 2, 5000);
    expect(r.principalMinor).toBe(200000n);
    expect(r.profitMinor).toBe(100000n);
    expect(r.maturityValueMinor).toBe(300000n);
  });

  it("computes 8h-plan example: ₦2,000 @ 50% → ₦3,000", () => {
    const r = computeInvestmentEconomics(200000n, 1, 5000);
    expect(r.maturityValueMinor).toBe(300000n);
  });

  it("rejects invalid quantities and ROI", () => {
    expect(() => computeInvestmentEconomics(100000n, 0, 5000)).toThrow();
    expect(() => computeInvestmentEconomics(100000n, 1.5, 5000)).toThrow();
    expect(() => computeInvestmentEconomics(100000n, 1, -1)).toThrow();
    expect(() => computeInvestmentEconomics(0n, 1, 5000)).toThrow();
  });

  it("one-slot maturity value drives minimum withdrawal", () => {
    // cheapest plan ₦1,000 @ 50% → min withdrawal ₦1,500
    expect(oneSlotMaturityValue(100000n, 5000)).toBe(150000n);
  });

  it("referral deposit reward: 5% capped per transaction", () => {
    // ₦100,000 deposit → ₦5,000 reward (under ₦10,000 cap)
    expect(referralDepositReward(10_000_000n, 500, 1_000_000n)).toBe(500000n);
    // ₦300,000 deposit → would be ₦15,000, capped at ₦10,000
    expect(referralDepositReward(30_000_000n, 500, 1_000_000n)).toBe(1000000n);
    // ₦1,000 deposit (minimum qualifying) → ₦50
    expect(referralDepositReward(100_000n, 500, 1_000_000n)).toBe(5000n);
  });
});
