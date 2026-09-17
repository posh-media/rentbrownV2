import { Module } from "@nestjs/common";

/**
 * Domain boundary stubs — Phase 1 establishes module ownership so later
 * phases fill in controllers/services without restructuring the backend.
 * Each maps to a bounded context from the approved architecture.
 */

// Auth/Identity is implemented in modules/identity — not a stub.

@Module({})
export class PropertiesModule {}

@Module({})
export class InvestmentPlansModule {}

@Module({})
export class InvestmentRoundsModule {}

@Module({})
export class InvestmentsModule {}

@Module({})
export class LedgerModule {}

@Module({})
export class PaymentsModule {}

@Module({})
export class WithdrawalsModule {}

@Module({})
export class ReferralsModule {}

@Module({})
export class RewardsModule {}

@Module({})
export class KycModule {}

@Module({})
export class NotificationsModule {}

@Module({})
export class AdminModule {}

@Module({})
export class FxModule {}

@Module({})
export class PoliciesModule {}
