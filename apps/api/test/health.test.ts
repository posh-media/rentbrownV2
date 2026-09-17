import { describe, expect, it, vi } from "vitest";
import { ServiceUnavailableException } from "@nestjs/common";
import type { Database } from "@rentbrown/database";
import type { Pool } from "pg";
import { HealthController } from "../src/modules/health/health.controller.js";

function make(dbOk: boolean) {
  const db = {
    execute: dbOk
      ? vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] })
      : vi.fn().mockRejectedValue(new Error("conn refused")),
  } as unknown as Database;
  const pool = { totalCount: 3 } as Pool;
  return new HealthController(db, pool);
}

describe("HealthController", () => {
  it("liveness always reports ok", () => {
    const c = make(true);
    expect(c.health().status).toBe("ok");
  });

  it("readiness reports ready when the DB responds", async () => {
    const c = make(true);
    await expect(c.ready()).resolves.toMatchObject({ status: "ready", db: "up" });
  });

  it("readiness fails with 503 when the DB is unreachable", async () => {
    const c = make(false);
    await expect(c.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
