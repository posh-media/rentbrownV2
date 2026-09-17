import { describe, expect, it } from "vitest";
import { redactKycPayload } from "./index.js";

describe("redactKycPayload", () => {
  it("keeps allowlisted outcome fields and drops everything else", () => {
    const out = redactKycPayload({
      status: "clear",
      message: "ok",
      reason: "matched",
      product: "enhanced_kyc",
      job_id: "job-1",
      user_id: "su-1",
      created_at: "2024-01-01",
      completed_at: "2024-01-02",
      partner_params: { case_id: "c1" },
      user_provided_info: { id_number: "12345678901", name: "Amina" },
      signature: "deadbeef",
    });
    expect(out.status).toBe("clear");
    expect(out.partner_params).toEqual({ case_id: "c1" });
    expect(out.user_provided_info).toBeUndefined();
    expect(out.signature).toBeUndefined();
  });

  it("reduces id_fields to key names only — never values", () => {
    const out = redactKycPayload({
      status: "clear",
      id_fields: { nin: "12345678901", dob: "1990-01-01" },
    });
    expect(out.id_fields).toEqual(["nin", "dob"]);
    expect(JSON.stringify(out)).not.toContain("12345678901");
    expect(JSON.stringify(out)).not.toContain("1990-01-01");
  });

  it("keeps only antifraud.status", () => {
    const out = redactKycPayload({ antifraud: { status: "OK", details: { secret: 1 } } });
    expect(out.antifraud).toEqual({ status: "OK" });
  });

  it("returns {} for non-object input", () => {
    expect(redactKycPayload(null)).toEqual({});
    expect(redactKycPayload("x")).toEqual({});
  });
});
