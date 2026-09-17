import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { sql } from "drizzle-orm";
import type { Database } from "@rentbrown/database";
import { DB, DB_POOL } from "../../database/database.module.js";
import type { Pool } from "pg";

@ApiTags("health")
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(DB_POOL) private readonly pool: Pool,
  ) {}

  /** liveness — process is up; cheap, no dependencies */
  @Get()
  health() {
    return { status: "ok", ts: new Date().toISOString() };
  }

  /** readiness — verifies DB connectivity; Cloud Run/Scheduler probe target */
  @Get("ready")
  async ready() {
    try {
      await this.db.execute(sql`select 1`);
      return { status: "ready", db: "up", poolTotal: this.pool.totalCount };
    } catch {
      throw new ServiceUnavailableException({
        code: "NOT_READY",
        message: "Database unreachable",
      });
    }
  }
}
