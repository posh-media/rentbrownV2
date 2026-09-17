import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard.js";
import { CurrentIdentity } from "../../common/decorators/current-user.decorator.js";
import type { SupabaseIdentity } from "../../common/supabase/jwt-verifier.js";
import { WalletService } from "./wallet.service.js";

@ApiTags("wallet")
@ApiBearerAuth()
@Controller({ path: "wallet", version: "1" })
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  /**
   * Read-only balance projection for the current user. Balances are
   * ledger-derived account rows — this endpoint never mutates and the
   * client can never write them.
   */
  @Get("summary")
  @UseGuards(SupabaseAuthGuard)
  summary(@CurrentIdentity() identity: SupabaseIdentity) {
    return this.wallet.summary(identity);
  }
}
