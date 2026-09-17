import type { MiddlewareConsumer, NestModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ConfigModule } from "./config/config.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { CorrelationMiddleware } from "./common/middleware/correlation.middleware.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { IdempotencyModule } from "./modules/idempotency/idempotency.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { JobsModule } from "./modules/jobs/jobs.module.js";
import { UsersModule } from "./modules/users/users.module.js";
import { WalletModule } from "./modules/wallet/wallet.module.js";
import {
  AdminModule,
  FxModule,
  InvestmentsModule,
  InvestmentPlansModule,
  InvestmentRoundsModule,
  KycModule,
  LedgerModule,
  NotificationsModule,
  PaymentsModule,
  PoliciesModule,
  PropertiesModule,
  ReferralsModule,
  RewardsModule,
  WithdrawalsModule,
} from "./modules/domain-boundaries.module.js";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    IdentityModule,
    AuditModule,
    IdempotencyModule,
    // global rate limiting — tighter per-route limits land with each domain
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    HealthModule,
    JobsModule,
    UsersModule,
    WalletModule,
    // domain boundaries — populated in later phases
    PropertiesModule,
    InvestmentPlansModule,
    InvestmentRoundsModule,
    InvestmentsModule,
    LedgerModule,
    PaymentsModule,
    WithdrawalsModule,
    ReferralsModule,
    RewardsModule,
    KycModule,
    NotificationsModule,
    AdminModule,
    FxModule,
    PoliciesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes("*");
  }
}
