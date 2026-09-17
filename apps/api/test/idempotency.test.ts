import { describe, expect, it } from "vitest";
import { ConflictException } from "@nestjs/common";
import type { Database } from "@rentbrown/database";
import { hashRequest, IdempotencyService } from "../src/modules/idempotency/idempotency.service.js";

/** minimal drizzle chain fake — returns preset rows from .limit() */
function fakeDb(rows: unknown[]): Database {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
  };
  return { select: () => chain } as unknown as Database;
}

describe("hashRequest", () => {
  it("is deterministic for identical payloads", () => {
    expect(hashRequest({ a: 1, b: "x" })).toBe(hashRequest({ a: 1, b: "x" }));
  });

  it("differs for different payloads", () => {
    expect(hashRequest({ a: 1 })).not.toBe(hashRequest({ a: 2 }));
    expect(hashRequest(null)).not.toBe(hashRequest({}));
  });
});

describe("IdempotencyService.lookup", () => {
  const storedRow = {
    key: "k1",
    userId: "u1",
    scope: "deposit",
    requestHash: hashRequest({ amount: "1000" }),
    responseStatus: 200,
    responseBody: { id: "dep_1" },
    expiresAt: new Date(Date.now() + 60_000),
  };

  it("returns the stored response for a matching key+hash", async () => {
    const svc = new IdempotencyService(fakeDb([storedRow]));
    const result = await svc.lookup("u1", "deposit", "k1", storedRow.requestHash!);
    expect(result).toEqual({ status: 200, body: { id: "dep_1" } });
  });

  it("returns null when no key is stored", async () => {
    const svc = new IdempotencyService(fakeDb([]));
    expect(await svc.lookup("u1", "deposit", "k1", "h")).toBeNull();
  });

  it("returns null for an in-flight reservation (no stored response yet)", async () => {
    const svc = new IdempotencyService(
      fakeDb([{ ...storedRow, responseStatus: null, responseBody: null }]),
    );
    expect(await svc.lookup("u1", "deposit", "k1", storedRow.requestHash!)).toBeNull();
  });

  it("rejects key reuse with a different payload — never re-executes", async () => {
    const svc = new IdempotencyService(fakeDb([storedRow]));
    await expect(
      svc.lookup("u1", "deposit", "k1", hashRequest({ amount: "9999" })),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
