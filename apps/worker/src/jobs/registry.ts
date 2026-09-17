import type PgBoss from "pg-boss";
import { heartbeatHandler, HEARTBEAT_JOB } from "./heartbeat.js";

export type JobHandler = (job: PgBoss.Job) => Promise<void>;

interface RegisteredJob {
  name: string;
  handler: JobHandler;
  /** singleton: coalesce duplicate enqueues while one is active */
  singleton?: boolean;
}

/**
 * Job registry — every job the worker can process is declared here.
 * Phase 1: infrastructure jobs only. Phase 2+ adds maturity sweeps,
 * outbox processing, reconciliation, stuck-state detection.
 */
const JOBS: RegisteredJob[] = [
  {
    name: HEARTBEAT_JOB,
    handler: heartbeatHandler,
    singleton: true,
  },
];

export class JobRegistry {
  readonly names: string[] = JOBS.map((j) => j.name);

  constructor(private readonly boss: PgBoss) {}

  async registerAll(): Promise<void> {
    for (const job of JOBS) {
      await this.boss.createQueue(job.name);
      await this.boss.work(job.name, { batchSize: 1 }, async (batch: PgBoss.Job[]) => {
        for (const j of batch) await job.handler(j);
      });
    }
  }

  /** enqueue helper used by API sweep endpoints (and tests) */
  async enqueue(name: string, data: Record<string, unknown> = {}) {
    const job = JOBS.find((j) => j.name === name);
    if (!job) throw new Error(`Unknown job: ${name}`);
    return this.boss.send(name, data, job.singleton ? { singletonKey: name } : {});
  }
}
