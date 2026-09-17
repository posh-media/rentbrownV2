import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PERMISSION_NAMES, ROLE_NAMES } from "./rbac.js";

const seedSql = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../drizzle/0002_seed_rbac_policies_terms.sql"),
  "utf-8",
);

describe("RBAC seed drift guard", () => {
  it("every ROLE_NAMES entry is seeded in 0002", () => {
    for (const role of ROLE_NAMES) {
      expect(seedSql).toContain(`'${role}'`);
    }
  });

  it("every PERMISSION_NAMES entry is seeded in 0002", () => {
    for (const permission of PERMISSION_NAMES) {
      expect(seedSql).toContain(`'${permission}'`);
    }
  });

  it("super_admin is granted via a cross join over all permissions", () => {
    expect(seedSql).toMatch(/CROSS JOIN "permissions"/);
    expect(seedSql).toMatch(/r\."name" = 'super_admin'/);
  });
});
