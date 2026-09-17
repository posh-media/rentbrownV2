import { loadConfig } from "@rentbrown/config";
import { JobRegistry } from "./jobs/registry.js";
import { createBoss } from "./boss.js";

/**
 * Worker entrypoint — pg-boss on Postgres (SKIP LOCKED under the hood).
 * Cloud Scheduler hits the API's /v1/jobs/sweep endpoints, which enqueue
 * named jobs here; the worker processes them with retry/backoff policy.
 *
 * Phase 1 registers infrastructure jobs only. Financial jobs (maturity,
 * reconciliation, outbox) land in Phase 2+ behind the same registry.
 */
async function main() {
  const config = loadConfig();
  const boss = await createBoss(config.DATABASE_URL);

  const registry = new JobRegistry(boss);
  await registry.registerAll();

  const shutdown = async (signal: string) => {
    console.log(JSON.stringify({ level: "info", msg: "worker stopping", signal }));
    await boss.stop({ graceful: true, timeout: 15_000 });
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  console.log(
    JSON.stringify({
      level: "info",
      msg: "worker started",
      env: config.APP_ENV,
      jobs: registry.names,
    }),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ level: "error", msg: "worker fatal", error: String(err) }));
  process.exit(1);
});
