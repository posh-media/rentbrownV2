import type PgBoss from "pg-boss";

export const JOB_QUEUE = Symbol("JOB_QUEUE");

/**
 * Narrow queue surface — the API can only enqueue whitelisted job names.
 * Job processing lives in the worker; the API is a trigger boundary only.
 */
export interface JobQueue {
  send(name: string, data?: Record<string, unknown>): Promise<string | null>;
}

/** jobs the API is permitted to trigger — keeps the trigger surface explicit */
const ALLOWED_JOBS = new Set(["ops.heartbeat"]);

export function createJobQueue(boss: PgBoss): JobQueue {
  return {
    async send(name, data = {}) {
      if (!ALLOWED_JOBS.has(name)) {
        throw new Error(`job not schedulable via API: ${name}`);
      }
      return boss.send(name, data, { singletonKey: name });
    },
  };
}
