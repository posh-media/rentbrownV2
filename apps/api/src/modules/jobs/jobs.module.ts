import { Module } from "@nestjs/common";
import PgBoss from "pg-boss";
import { AppConfigService } from "../../config/config.service.js";
import { JobsController } from "./jobs.controller.js";
import { JOB_QUEUE, createJobQueue, type JobQueue } from "./jobs.provider.js";

/**
 * Jobs trigger module — API side of the scheduler pipeline.
 * Creates a lightweight pg-boss client for enqueues only; the worker owns
 * processing. If the queue can't start, the API still boots — sweep
 * endpoints return 503 rather than taking down the whole service.
 */
@Module({
  controllers: [JobsController],
  providers: [
    {
      provide: JOB_QUEUE,
      inject: [AppConfigService],
      useFactory: async (config: AppConfigService): Promise<JobQueue | null> => {
        try {
          const boss = new PgBoss({
            connectionString: config.get("DATABASE_URL"),
            schema: "pgboss",
          });
          boss.on("error", (err) => {
            console.error(
              JSON.stringify({ level: "error", msg: "api pg-boss error", error: String(err) }),
            );
          });
          await boss.start();
          return createJobQueue(boss);
        } catch (err) {
          console.error(
            JSON.stringify({
              level: "error",
              msg: "job queue init failed — sweeps disabled",
              error: String(err),
            }),
          );
          return null;
        }
      },
    },
  ],
})
export class JobsModule {}
