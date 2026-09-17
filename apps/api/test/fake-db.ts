import type { Database } from "@rentbrown/database";

/**
 * Scriptable drizzle chain fake. Every method returns the same chain; each
 * terminal call (`.limit()`, `.returning()`, or awaiting the chain directly)
 * pops the next queued result. Queue an `Error` to make that call reject.
 * `transaction(cb)` runs cb against the same chain so transactional code
 * paths are exercised identically.
 *
 * `captures` records every `.values(...)` and `.set(...)` argument so tests
 * can assert exactly what would be persisted (e.g. "never the full ID").
 */
export interface FakeDbCaptures {
  values: unknown[];
  sets: unknown[];
}

export function fakeDb(results: unknown[] = []) {
  const captures: FakeDbCaptures = { values: [], sets: [] };
  const next = () => {
    const r = results.shift();
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve(r ?? []);
  };
  const chain: Record<string, unknown> = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    set: (v: unknown) => {
      captures.sets.push(v);
      return chain;
    },
    values: (v: unknown) => {
      captures.values.push(v);
      return chain;
    },
    onConflictDoNothing: () => chain,
    limit: next,
    returning: next,
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => next().then(res, rej),
  };
  const db = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    transaction: async (cb: (tx: unknown) => unknown) => cb(db),
    captures,
  };
  return db as unknown as Database & { captures: FakeDbCaptures };
}
