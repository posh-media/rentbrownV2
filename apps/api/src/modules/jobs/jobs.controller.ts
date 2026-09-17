import {
  Controller,
  Inject,
  Param,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  Headers,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AppConfigService } from "../../config/config.service.js";
import { JOB_QUEUE, type JobQueue } from "./jobs.provider.js";

/**
 * Cloud Scheduler sweep entrypoints. Scheduler is a trigger only — it never
 * carries financial logic. Each name maps to a pg-boss queue the worker owns.
 *
 * Auth: shared `x-scheduler-key` secret (Cloud Scheduler custom header),
 * NOT a user JWT — scheduler calls are server-to-server.
 */
@ApiTags("jobs")
@Controller({ path: "jobs", version: "1" })
export class JobsController {
  constructor(
    private readonly config: AppConfigService,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue | null,
  ) {}

  @Post("sweep/:name")
  async sweep(@Param("name") name: string, @Headers("x-scheduler-key") key: string | undefined) {
    const expected = this.config.get("SCHEDULER_SECRET");
    if (!expected) {
      throw new ServiceUnavailableException({
        code: "SCHEDULER_NOT_CONFIGURED",
        message: "Scheduler secret not configured",
      });
    }
    if (!key || key !== expected) {
      throw new UnauthorizedException("Invalid scheduler key");
    }
    if (!this.queue) {
      throw new ServiceUnavailableException({
        code: "QUEUE_UNAVAILABLE",
        message: "Job queue unavailable",
      });
    }
    const jobId = await this.queue.send(name);
    return { queued: true, job: name, jobId };
  }
}
