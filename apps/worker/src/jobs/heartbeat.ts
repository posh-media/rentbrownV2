import type PgBoss from "pg-boss";

export const HEARTBEAT_JOB = "ops.heartbeat";

/**
 * Infrastructure test job — proves the queue pipeline works end-to-end
 * (enqueue → claim → execute → complete) without touching financial state.
 * Scheduled by Cloud Scheduler hitting the API sweep endpoint; also used
 * by ops to verify worker liveness.
 */
export async function heartbeatHandler(job: PgBoss.Job): Promise<void> {
  console.log(
    JSON.stringify({
      level: "info",
      msg: "heartbeat processed",
      jobId: job.id,
      triggeredAt: (job.data as { triggeredAt?: string }).triggeredAt ?? null,
      processedAt: new Date().toISOString(),
    }),
  );
}
