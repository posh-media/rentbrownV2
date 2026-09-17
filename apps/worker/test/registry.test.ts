import { describe, expect, it, vi } from "vitest";
import type PgBoss from "pg-boss";
import { JobRegistry } from "../src/jobs/registry.js";
import { HEARTBEAT_JOB } from "../src/jobs/heartbeat.js";

function fakeBoss() {
  return {
    createQueue: vi.fn().mockResolvedValue(undefined),
    work: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue("job-id-1"),
  } as unknown as PgBoss;
}

describe("JobRegistry", () => {
  it("registers all declared jobs with pg-boss", async () => {
    const boss = fakeBoss();
    const registry = new JobRegistry(boss);
    await registry.registerAll();
    expect(boss.createQueue).toHaveBeenCalledWith(HEARTBEAT_JOB);
    expect(boss.work).toHaveBeenCalledWith(
      HEARTBEAT_JOB,
      expect.objectContaining({ batchSize: 1 }),
      expect.any(Function),
    );
  });

  it("enqueues a known job", async () => {
    const boss = fakeBoss();
    const registry = new JobRegistry(boss);
    const id = await registry.enqueue(HEARTBEAT_JOB, { triggeredAt: "t" });
    expect(id).toBe("job-id-1");
    expect(boss.send).toHaveBeenCalledWith(
      HEARTBEAT_JOB,
      { triggeredAt: "t" },
      { singletonKey: HEARTBEAT_JOB },
    );
  });

  it("refuses to enqueue an unknown job", async () => {
    const registry = new JobRegistry(fakeBoss());
    await expect(registry.enqueue("nope.unknown")).rejects.toThrow("Unknown job");
  });
});
