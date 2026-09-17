import { describe, expect, it } from "vitest";
import * as money from "./money.js";

describe("money", () => {
  it("creates minor units from int/string/bigint", () => {
    expect(money.minor(150000)).toBe(150000n);
    expect(money.minor("150000")).toBe(150000n);
    expect(money.minor(150000n)).toBe(150000n);
  });

  it("rejects unsafe/float inputs", () => {
    expect(() => money.minor(1.5)).toThrow();
    expect(() => money.minor(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => money.minor("12.5")).toThrow();
    expect(() => money.minor("abc")).toThrow();
  });

  it("adds, subtracts, compares", () => {
    expect(money.add(100n, 50n)).toBe(150n);
    expect(money.sub(100n, 150n)).toBe(-50n);
    expect(money.cmp(5n, 10n)).toBe(-1);
    expect(money.cmp(10n, 10n)).toBe(0);
    expect(money.isNegative(-1n)).toBe(true);
    expect(money.isPositive(1n)).toBe(true);
  });

  it("applies basis points half-up", () => {
    expect(money.applyBps(200000n, 5000)).toBe(100000n); // ₦2,000 × 50%
    expect(money.applyBps(101n, 5000)).toBe(51n); // 50.5 → 51 half-up
    expect(money.applyBps(103n, 3333)).toBe(34n); // 34.33 → 34
  });

  it("computes capped percent fee", () => {
    // 5% of ₦2,000 = ₦100, cap ₦10,000 → ₦100
    expect(money.percentFeeCapped(200000n, 500, 1000000n)).toBe(10000n);
    // 5% of ₦500,000 = ₦25,000, capped at ₦10,000
    expect(money.percentFeeCapped(50000000n, 500, 1000000n)).toBe(1000000n);
  });

  it("parses major-unit input", () => {
    expect(money.parseMajor("1500", "NGN")).toBe(150000n);
    expect(money.parseMajor("1,500.50", "NGN")).toBe(150050n);
    expect(money.parseMajor("25.99", "USD")).toBe(2599n);
    expect(() => money.parseMajor("abc", "NGN")).toThrow();
    expect(() => money.parseMajor("1.234", "NGN")).toThrow();
  });

  it("formats for display", () => {
    expect(money.format(150000n, "NGN")).toBe("₦1,500.00");
    expect(money.format(2599n, "USD")).toBe("$25.99");
    expect(money.format(123456789n, "NGN")).toBe("₦1,234,567.89");
    expect(money.format(-5000n, "NGN")).toBe("-₦50.00");
  });

  it("serializes as minor-unit string", () => {
    expect(money.serialize(150000n)).toBe("150000");
  });
});
