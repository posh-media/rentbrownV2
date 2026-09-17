import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../drizzle/0001_identity_rbac.sql"),
  "utf-8",
);

describe("0001_identity_rbac", () => {
  it("converts account_status safely: DROP DEFAULT → SET DATA TYPE … USING → SET DEFAULT", () => {
    // Postgres refuses SET DATA TYPE when the existing varchar default can't
    // be auto-cast — the default must be dropped first and re-added after.
    const drop = migration.indexOf('ALTER COLUMN "account_status" DROP DEFAULT');
    const cast = migration.indexOf(
      "SET DATA TYPE account_status USING account_status::account_status",
    );
    const setDef = migration.indexOf("ALTER COLUMN \"account_status\" SET DEFAULT 'ACTIVE'");
    expect(drop).toBeGreaterThan(-1);
    expect(cast).toBeGreaterThan(drop);
    expect(setDef).toBeGreaterThan(cast);
  });
});

describe("0003_kyc_foundation", () => {
  const sql = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../drizzle/0003_kyc_foundation.sql"),
    "utf-8",
  );

  it("converts kyc_cases.status safely: DROP DEFAULT → SET DATA TYPE … USING → SET DEFAULT", () => {
    const drop = sql.indexOf('"kyc_cases" ALTER COLUMN "status" DROP DEFAULT');
    const cast = sql.indexOf("SET DATA TYPE kyc_status USING status::kyc_status");
    const setDef = sql.indexOf('"kyc_cases" ALTER COLUMN "status" SET DEFAULT \'DRAFT\'');
    expect(drop).toBeGreaterThan(-1);
    expect(cast).toBeGreaterThan(drop);
    expect(setDef).toBeGreaterThan(cast);
  });
});
