import { describe, expect, it } from "vitest";
import { addDuration, computeMaturesAt } from "./duration.js";

const T0 = new Date("2026-01-15T12:00:00Z");

describe("duration", () => {
  it("adds hours/days/weeks as elapsed time", () => {
    expect(addDuration(T0, { value: 8, unit: "HOURS" }).toISOString()).toBe(
      "2026-01-15T20:00:00.000Z",
    );
    expect(addDuration(T0, { value: 3, unit: "DAYS" }).toISOString()).toBe(
      "2026-01-18T12:00:00.000Z",
    );
    expect(addDuration(T0, { value: 2, unit: "WEEKS" }).toISOString()).toBe(
      "2026-01-29T12:00:00.000Z",
    );
  });

  it("adds months with calendar arithmetic", () => {
    expect(addDuration(T0, { value: 1, unit: "MONTHS" }).toISOString()).toBe(
      "2026-02-15T12:00:00.000Z",
    );
    // Jan 31 + 1 month → Feb 28 (end-of-month clamp)
    expect(
      addDuration(new Date("2026-01-31T10:00:00Z"), { value: 1, unit: "MONTHS" }).toISOString(),
    ).toBe("2026-02-28T10:00:00.000Z");
    // leap year: Jan 31 2024 + 1mo → Feb 29
    expect(
      addDuration(new Date("2024-01-31T10:00:00Z"), { value: 1, unit: "MONTHS" }).toISOString(),
    ).toBe("2024-02-29T10:00:00.000Z");
  });

  it("adds years across leap boundaries", () => {
    expect(addDuration(T0, { value: 1, unit: "YEARS" }).toISOString()).toBe(
      "2027-01-15T12:00:00.000Z",
    );
    // Feb 29 2024 + 1yr → Feb 28 2025
    expect(
      addDuration(new Date("2024-02-29T08:00:00Z"), { value: 1, unit: "YEARS" }).toISOString(),
    ).toBe("2025-02-28T08:00:00.000Z");
  });

  it("rejects invalid durations", () => {
    expect(() => addDuration(T0, { value: 0, unit: "DAYS" })).toThrow();
    expect(() => addDuration(T0, { value: 1.5, unit: "DAYS" })).toThrow();
    // @ts-expect-error invalid unit
    expect(() => addDuration(T0, { value: 1, unit: "MINUTES" })).toThrow();
  });

  it("computeMaturesAt uses activation time (per-investment countdown)", () => {
    const activated = new Date("2026-09-17T12:00:00Z");
    expect(computeMaturesAt(activated, { value: 8, unit: "HOURS" }).toISOString()).toBe(
      "2026-09-17T20:00:00.000Z",
    );
  });
});
