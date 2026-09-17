import { Global, Module } from "@nestjs/common";
import type { Pool } from "pg";
import { createDb, createPool, type Database } from "@rentbrown/database";
import { AppConfigService } from "../config/config.service.js";

export const DB_POOL = Symbol("DB_POOL");
export const DB = Symbol("DB");

@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): Pool => createPool(config.get("DATABASE_URL")),
    },
    {
      provide: DB,
      inject: [DB_POOL],
      useFactory: (pool: Pool): Database => createDb(pool),
    },
  ],
  exports: [DB_POOL, DB],
})
export class DatabaseModule {}
