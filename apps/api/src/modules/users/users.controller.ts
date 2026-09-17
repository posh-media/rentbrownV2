import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard.js";
import { CurrentIdentity } from "../../common/decorators/current-user.decorator.js";
import type { SupabaseIdentity } from "../../common/supabase/jwt-verifier.js";
import { UsersService } from "./users.service.js";

@ApiTags("users")
@ApiBearerAuth()
@Controller({ path: "users", version: "1" })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** returns the internal user record, provisioning it on first call */
  @Get("me")
  @UseGuards(SupabaseAuthGuard)
  async me(@CurrentIdentity() identity: SupabaseIdentity) {
    const user = await this.users.findOrProvision(identity);
    return {
      id: user.id,
      externalSubject: user.externalSubject,
      email: user.email,
      displayName: user.displayName,
      username: user.username,
      referralCode: user.referralCode,
      accountCurrency: user.accountCurrency,
      displayCurrency: user.displayCurrency,
      accountStatus: user.accountStatus,
      createdAt: user.createdAt,
    };
  }
}
